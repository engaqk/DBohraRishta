import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import * as OTPAuth from "otpauth";
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

export async function POST(req: Request) {
    // Initialize at request time so env vars are available at runtime
    const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    const FIREBASE_DETERMINISTIC_SALT = process.env.FIREBASE_DETERMINISTIC_SALT || 'dbohrarishta_firebase_salt_2026';

    try {
        const { phone, code } = await req.json();

        if (!phone || !code) {
            return NextResponse.json({ error: 'Phone and OTP code are required' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[\s\-\+()]/g, '');

        // 1. Fetch the secret from Redis using the phone number
        const savedSecret: string | null = await redis.get(`otp:${cleanPhone}`);

        if (!savedSecret) {
            return NextResponse.json({ error: 'OTP expired or not found' }, { status: 400 });
        }

        // 2. Verify the OTP against the saved secret
        const totp = new OTPAuth.TOTP({
            secret: savedSecret,
            digits: 6,
            period: 300,
        });

        const isValid = totp.validate({ token: code.toString(), window: 1 }) !== null;

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid or expired OTP code' }, { status: 400 });
        }

        // SUCCESS!
        // 3. Delete the OTP from Redis so it can't be reused
        await redis.del(`otp:${cleanPhone}`);

        // 4. Generate deterministic Firebase internal credentials
        const internalEmail = `${cleanPhone}@dbohrarishta.local`;
        const internalPassword = crypto
            .createHmac('sha256', FIREBASE_DETERMINISTIC_SALT)
            .update(cleanPhone)
            .digest('hex')
            .substring(0, 24);

        // 5. Cache the verified phone in Redis for 1 hour so onboarding can read it
        await redis.set(`verified_phone:${internalEmail}`, phone, { ex: 3600 });

        return NextResponse.json({
            success: true,
            internalEmail,
            internalPassword,
            verifiedPhone: phone,    // returned to frontend to store in sessionStorage
            loginMethod: 'mobile',   // flag so onboarding knows this is a mobile-registered user
            message: 'Phone verified successfully',
        });

    } catch (error: any) {
        console.error('OTP verify error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
