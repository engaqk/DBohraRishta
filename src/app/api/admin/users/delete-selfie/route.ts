import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
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

        if (!adminDb) {
            return NextResponse.json({ error: 'Admin DB not configured' }, { status: 503 });
        }

        const batch = adminDb.batch();
        const userRef = adminDb.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        // 1. Update user master doc
        const updateData: any = {
            isPhotoVerified: false,
            selfieStatus: admin.firestore.FieldValue.delete(),
            selfieUrl: admin.firestore.FieldValue.delete(),
            selfieImageUrl: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.update(userRef, updateData);

        // 2. Log Action in Audit Log
        const auditRef = adminDb.collection('admin_audit_logs').doc();
        batch.set(auditRef, {
            adminId: adminId || 'admin',
            action: 'selfie_deleted',
            targetUserId: userId,
            targetUserName: userData?.name || 'Unknown',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. In-App Notification
        const notifRef = adminDb.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'selfie_deleted',
            title: 'SELFIE DELETED BY ADMIN',
            message: 'Your selfie was removed by the admin. Please upload a new, clear selfie for verification.',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[delete-selfie] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
