import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// A fixed, dedicated UID for the admin panel session.
// This user never appears in the regular users collection.
const ADMIN_PANEL_UID = 'admin-panel-service-account';

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        // Validate admin credentials server-side
        if (username !== 'admin' || password !== 'admin53') {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        if (!adminAuth) {
            // Firebase Admin not configured — fall back to localStorage-only admin session
            return NextResponse.json({ fallback: true });
        }

        // Issue a custom Firebase token for the dedicated admin UID.
        // Custom claim admin: true is what Firestore rules check.
        const customToken = await adminAuth.createCustomToken(ADMIN_PANEL_UID, {
            admin: true,
        });

        return NextResponse.json({ success: true, customToken });

    } catch (error: any) {
        console.error('Admin token error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
