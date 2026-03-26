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

        const smsText = `Your 53DBohraRishta verification code is: ${otp}. Do not share it with anyone.`;
        const { sendSMS } = await import('@/lib/smsService');
        const result = await sendSMS(phone, smsText);

        if (result.success) {
            console.log("OTP Send SMS Success:", result.data);
            return NextResponse.json({
                success: true,
                message: 'OTP sent successfully'
            });
        } else {
            console.error("OTP Send SMS Error:", result.error);
            return NextResponse.json({
                error: result.error || 'Failed to send SMS message',
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('OTP send error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
