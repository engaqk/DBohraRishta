import { NextResponse } from 'next/server';
import * as OTPAuth from "otpauth";
import { Redis } from '@upstash/redis';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export async function POST(req: Request) {
    try {
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
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

        // E.164 required for SMS API
        const smsTo = phone; // Assuming frontend enforces +91 format

        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;

        const textbeeRes = await fetch(textbeeUrl, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                receivers: [smsTo],
                smsBody: smsText
            })
        });

        if (!textbeeRes.ok) {
            let errorMsg = 'Failed to send SMS message';
            try {
                const errorData = await textbeeRes.json();
                console.error("Textbee API error:", JSON.stringify(errorData, null, 2));
                errorMsg = errorData.message || errorMsg;
            } catch {
                console.error("Textbee API error: Unparseable response");
            }
            return NextResponse.json({
                error: errorMsg,
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'OTP sent successfully'
        });

    } catch (error: any) {
        console.error('OTP send error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
