import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        if (!adminAuth || typeof adminAuth.listUsers !== 'function') {
            return NextResponse.json({ error: 'Admin service not configured' }, { status: 503 });
        }
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Paginate through all users (Firebase returns max 1000 per call)
        const allUsers: any[] = [];
        let pageToken: string | undefined;
        do {
            const result = await adminAuth.listUsers(1000, pageToken);
            result.users.forEach(u => {
                // Extract readable mobile number from internal email convention
                // e.g. +919876543210@dbohrarishta.local → +919876543210
                const mobileFromEmail = u.email?.endsWith('@dbohrarishta.local')
                    ? u.email.replace('@dbohrarishta.local', '')
                    : null;

                allUsers.push({
                    uid: u.uid,
                    email: mobileFromEmail ? null : u.email,   // hide internal email; show mobile instead
                    mobile: mobileFromEmail || u.phoneNumber || null,
                    emailVerified: u.emailVerified,
                    displayName: u.displayName,
                    photoURL: u.photoURL,
                    phoneNumber: u.phoneNumber,
                    disabled: u.disabled,
                    lastSignInTime: u.metadata.lastSignInTime,
                    creationTime: u.metadata.creationTime,
                    providers: u.providerData.map((p: any) => p.providerId),
                    isMobileUser: !!mobileFromEmail,
                });
            });
            pageToken = result.pageToken;
        } while (pageToken);

        // Sort newest registration first (latest email/mobile at top)
        allUsers.sort((a, b) =>
            new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
        );

        // Exclude the internal admin panel service account
        const filtered = allUsers.filter(u => u.uid !== 'admin-panel-service-account');

        return NextResponse.json({ users: filtered });
    } catch (error: any) {
        console.error('Error fetching auth users:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
