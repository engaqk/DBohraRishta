import { NextResponse } from 'next/server';
import * as OTPAuth from "otpauth";
import { Redis } from '@upstash/redis';
import { normalizePhone } from '@/lib/phoneUtils';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    try {
        const { phone: rawPhone } = await req.json();

        if (!rawPhone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        // Normalize phone before any processing — fixes +9109... → +919... etc.
        const phone = normalizePhone(rawPhone);
        if (!phone) {
            return NextResponse.json({ error: 'Invalid phone number format. Use international format e.g. +919876543210' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[\s\-+()]/g, '');
        if (cleanPhone.length < 10) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        // 1. Generate a 6-digit OTP using otpauth (more compatible with ESM/Serverless)
        const secret = new OTPAuth.Secret({ size: 20 }).base32;
        const totp = new OTPAuth.TOTP({
            secret: secret,
            digits: 6,
            period: 300, // 5 minutes
        });
        const otp = totp.generate();

        // 2. Save the secret to Redis (linked to phone number) for 5 minutes
        await redis.set(`otp:${cleanPhone}`, secret, { ex: 300 });

        // 3. Send SMS via Textbee Android App Gateway
        const deviceId = process.env.TEXTBEE_DEVICE_ID;
        const apiKey = process.env.TEXTBEE_API_KEY;

        if (!deviceId || !apiKey) {
            console.error("Textbee credentials missing from environment variables");
            return NextResponse.json({ error: 'SMS service not configured on server' }, { status: 500 });
        }

        const smsText = `Your 53DBohraRishta verification code is: ${otp}. Do not share it with anyone.`;

        // E.164 format guaranteed by normalizePhone above
        const smsTo = phone;

        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

        try {
            const { default: axios } = await import('axios');
            const response = await axios.post(textbeeUrl, {
                recipients: [smsTo],
                message: smsText
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });

            console.log("Textbee SMS API Success:", response.data);

            return NextResponse.json({
                success: true,
                message: 'OTP sent successfully'
            });

        } catch (apiError: any) {
            let errorMsg = 'Failed to send SMS message';
            if (apiError.response) {
                console.error("Textbee API Error Data:", apiError.response.data);
                errorMsg = apiError.response.data?.message || `Textbee API Error: ${apiError.response.statusText}`;
            } else if (apiError.request) {
                console.error("Textbee API No Response:", apiError.request);
                errorMsg = "No response from SMS service provider.";
            } else {
                console.error("Textbee Request Error:", apiError.message);
                errorMsg = `SMS Error: ${apiError.message}`;
            }

            return NextResponse.json({
                error: errorMsg,
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('OTP send error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
