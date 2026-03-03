import { NextResponse } from 'next/server';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import crypto from 'crypto';

const TOTP_MASTER_SECRET = process.env.TOTP_MASTER_SECRET || 'dbohrarishta_totp_master_2026';

/**
 * Given a phone number, deterministically derive a TOTP secret.
 * This means the same phone always gets the same QR code — no DB needed.
 */
function deriveSecret(phone: string): string {
    const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
    // Create a 20-byte HMAC-SHA1 (perfect size for TOTP base32 secret)
    const hmac = crypto.createHmac('sha1', TOTP_MASTER_SECRET).update(cleanPhone).digest();
    // Encode as base32 (required by TOTP/Google Authenticator)
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
        const { phone } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
        if (cleanPhone.length < 10) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        // 1. Derive deterministic secret for this phone number
        const secretStr = deriveSecret(phone);

        // 2. Build the TOTP URL (otpauth:// URI)
        const totp = new OTPAuth.TOTP({
            issuer: 'DBohraRishta',
            label: cleanPhone,
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secretStr),
        });

        const otpauthUrl = totp.toString();

        // 3. Generate QR code as a base64 data URL
        const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
            width: 256,
            margin: 2,
            color: { dark: '#881337', light: '#FFFFFF' },
        });

        return NextResponse.json({
            success: true,
            qrDataUrl,
            otpauthUrl,
            phone,
            // Hint: secretStr can be shown as manual entry fallback
            manualKey: secretStr,
        });

    } catch (error: any) {
        console.error('TOTP setup error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
