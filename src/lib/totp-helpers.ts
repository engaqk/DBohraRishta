import * as OTPAuth from "otpauth";

const TOTP_LABEL = "DBohraRishta";

/**
 * Derives a deterministic Base32 secret string from a phone number using simple XOR/hashing.
 * This is consistent with our Login page system.
 */
export function deriveBase32Secret(phone: string): string {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const PEPPER = "dbohra_totp_pepper_v1";
    const input = `${PEPPER}:${clean}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let seed = Math.abs(hash);
    let out = "";
    for (let i = 0; i < 32; i++) {
        const charCode = clean.charCodeAt(i % clean.length) || 1;
        const index = ((seed ^ charCode ^ (i * 31)) >>> 0) % 32;
        out += B32[index];
        seed = ((seed * 1664525) + 1013904223) >>> 0;
    }
    return out;
}

/**
 * Verifies a 6-digit TOTP code against a secret string.
 */
export function verifyTOTP(secret: string, code: string): boolean {
    const cleanSecret = secret.trim();
    if (!cleanSecret) return false;

    try {
        const totp = new OTPAuth.TOTP({
            issuer: TOTP_LABEL,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(cleanSecret),
        });

        // window: 1 allows for +/- 30 seconds of clock skew
        return totp.validate({ token: code.toString().trim(), window: 1 }) !== null;
    } catch (e) {
        console.error("TOTP Verification error:", e);
        return false;
    }
}

/**
 * Builds the otpauth:// URL used for generating QR codes in authenticator apps.
 */
export function buildOtpAuthUrl(phone: string, secret: string): string {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const totp = new OTPAuth.TOTP({
        issuer: TOTP_LABEL,
        label: clean,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.toString();
}

/**
 * Generates deterministic Firebase internal credentials (email/password) from a phone number.
 */
export function phoneToFirebaseCredentials(phone: string) {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const internalEmail = `p${clean}@dbohra.app`;
    const SALT = "fb_salt_dbohra_v2_2026";
    let hash = 5381;
    const input = SALT + clean;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash |= 0;
    }
    const internalPassword = "Db" + Math.abs(hash).toString(36).padStart(10, "0").substring(0, 18);
    return { internalEmail, internalPassword };
}
