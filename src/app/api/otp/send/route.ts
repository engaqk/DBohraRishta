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
        const { phone: rawPhone, email } = await req.json();

        if (!rawPhone && !email) {
            return NextResponse.json({ error: 'Phone number or Email is required' }, { status: 400 });
        }

        let identifier = '';
        if (email) {
            identifier = email.toLowerCase().trim();
        } else {
            // Normalize phone before any processing — fixes +9109... → +919... etc.
            const phone = normalizePhone(rawPhone);
            if (!phone) {
                return NextResponse.json({ error: 'Invalid phone number format. Use international format e.g. +919876543210' }, { status: 400 });
            }
            identifier = phone.replace(/[\s\-+()]/g, '');
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
        await redis.set(`otp:${identifier}`, secret, { ex: 300 });

        if (email) {
            const { sendEmail } = await import('@/lib/emailService');
            const { getVerificationEmailTemplate } = await import('@/lib/emailTemplates');
            
            await sendEmail({
                toEmail: email,
                subject: `${otp} is your 53DBohraRishta verification code`,
                htmlBody: getVerificationEmailTemplate({ otpCode: otp })
            });

            return NextResponse.json({
                success: true,
                message: 'Verification code sent to email'
            });
        } else {
            const phone = normalizePhone(rawPhone)!;
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
        }
    } catch (error: any) {
        console.error('OTP send error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
