import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import crypto from 'crypto';

/**
 * Checks if a phone number has a Firebase account already.
 * If yes, returns credentials so the frontend can sign in directly (no OTP needed).
 * Uses Firebase Admin SDK to verify user existence server-side.
 */
export async function POST(req: Request) {
    try {
        const { phone } = await req.json();
        if (!phone) {
            return NextResponse.json({ error: 'Phone is required' }, { status: 400 });
        }

        const cleanPhone = phone.replace(/[\s\-\+()]/g, '');
        const FIREBASE_DETERMINISTIC_SALT = process.env.FIREBASE_DETERMINISTIC_SALT || 'dbohrarishta_firebase_salt_2026';

        const internalEmail = `${cleanPhone}@dbohrarishta.local`;
        const internalPassword = crypto
            .createHmac('sha256', FIREBASE_DETERMINISTIC_SALT)
            .update(cleanPhone)
            .digest('hex')
            .substring(0, 24);

        // Check if user exists in Auth AND has completed onboarding in Firestore
        let canDirectLogin = false;
        try {
            const { adminAuth, adminDb } = await import('@/lib/firebase/admin');
            if (adminAuth && adminDb && typeof adminAuth.getUserByEmail === 'function') {
                const userRecord = await adminAuth.getUserByEmail(internalEmail);

                // Now check Firestore for completed onboarding
                const userDoc = await adminDb.collection('users').doc(userRecord.uid).get();
                if (userDoc.exists && userDoc.data()?.isCandidateFormComplete === true) {
                    canDirectLogin = true;
                }
            }
        } catch (adminError: any) {
            if (adminError?.errorInfo?.code === 'auth/user-not-found' ||
                adminError?.code === 'auth/user-not-found') {
                canDirectLogin = false;
            } else {
                console.warn('[mobile-check] Admin check failed, falling back to OTP:', adminError?.message);
                return NextResponse.json({ exists: false });
            }
        }

        if (canDirectLogin) {
            return NextResponse.json({
                exists: true,
                internalEmail,
                internalPassword,
            });
        }

        return NextResponse.json({ exists: false });

    } catch (error: any) {
        console.error('[mobile-check] Error:', error.message);
        return NextResponse.json({ exists: false });
    }
}
