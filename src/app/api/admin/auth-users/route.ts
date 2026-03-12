import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export async function GET(request: Request) {
    try {
        // Basic check for admin session
        // Note: In production, use genuine session validation
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const listUsersResult = await adminAuth.listUsers(1000);
        const users = listUsersResult.users.map(userRecord => ({
            uid: userRecord.uid,
            email: userRecord.email,
            emailVerified: userRecord.emailVerified,
            displayName: userRecord.displayName,
            photoURL: userRecord.photoURL,
            phoneNumber: userRecord.phoneNumber,
            disabled: userRecord.disabled,
            lastSignInTime: userRecord.metadata.lastSignInTime,
            creationTime: userRecord.metadata.creationTime,
            providers: userRecord.providerData.map(p => p.providerId)
        }));

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error('Error fetching auth users:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
