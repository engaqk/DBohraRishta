import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
             return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, adminId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        if (!adminDb || !adminAuth) {
            return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 503 });
        }

        // 1. Get user data for logging before deletion
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        // 2. Clear Firestore user data
        await userRef.delete();

        // 3. Delete from Firebase Auth if exists
        try {
            await adminAuth.deleteUser(userId);
        } catch (authError: any) {
            console.warn(`Auth deletion failed for ${userId}: ${authError.message}`);
            // If user doesn't exist in Auth, just continue
        }

        // 4. Log Action in Audit Log
        const auditRef = adminDb.collection('admin_audit_logs').doc();
        await auditRef.set({
            adminId: adminId || 'admin',
            action: 'delete_user_profile_complete',
            targetUserId: userId,
            targetUserName: userData?.name || 'Unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[delete-user] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
