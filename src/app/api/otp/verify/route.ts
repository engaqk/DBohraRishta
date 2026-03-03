import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import crypto from 'crypto';

const TOTP_MASTER_SECRET = process.env.TOTP_MASTER_SECRET || 'dbohrarishta_totp_master_2026';
const FIREBASE_DETERMINISTIC_SALT = process.env.FIREBASE_DETERMINISTIC_SALT || 'dbohrarishta_firebase_salt_2026';

function deriveSecret(phone: string): string {
    const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
    const hmac = crypto.createHmac('sha1', TOTP_MASTER_SECRET).update(cleanPhone).digest();
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of hmac) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += base32Chars[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += base32Chars[(value << (5 - bits)) & 31];
    }
    return output;
}

export async function POST(req: Request) {
    try {
        const { phone, code } = await req.json();

        if (!phone || !code) {
            return NextResponse.json({ error: 'Phone and TOTP code are required' }, { status: 400 });
        }

        // 1. Re-derive the same secret for this phone
        const secretStr = deriveSecret(phone);

        // 2. Validate the 6-digit code against the TOTP
        const totp = new OTPAuth.TOTP({
            issuer: 'DBohraRishta',
            label: phone.replace(/[\s\-\+()]/g, ''),
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secretStr),
        });

        // delta: ±1 means we accept 30 seconds before/after for clock skew
        const delta = totp.validate({ token: code.toString(), window: 1 });

        if (delta === null) {
            return NextResponse.json({
                error: 'Invalid or expired code. Make sure your phone clock is synced and try the latest code from your authenticator app.',
            }, { status: 400 });
        }

        // 3. Generate deterministic Firebase internal credentials
        const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
        const internalEmail = `${cleanPhone}@dbohrarishta.local`;
        const internalPassword = crypto
            .createHmac('sha256', FIREBASE_DETERMINISTIC_SALT)
            .update(cleanPhone)
            .digest('hex')
            .substring(0, 24);

        return NextResponse.json({
            success: true,
            internalEmail,
            internalPassword,
            message: 'TOTP Verified Successfully',
        });

    } catch (error: any) {
        console.error('TOTP verify error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
