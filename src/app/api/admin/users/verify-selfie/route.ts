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
        const { userId, adminId, isApproved } = body;

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
            isPhotoVerified: isApproved,
            selfieStatus: isApproved ? 'verified' : 'rejected',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.update(userRef, updateData);

        // 2. Log Action in Audit Log
        const auditRef = adminDb.collection('admin_audit_logs').doc();
        batch.set(auditRef, {
            adminId: adminId || 'admin',
            action: 'selfie_verification',
            targetUserId: userId,
            targetUserName: userData?.name || 'Unknown',
            status: isApproved ? 'verified' : 'rejected',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. In-App Notification
        const notifRef = adminDb.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'selfie_verification',
            title: isApproved ? 'PHOTO VERIFIED' : 'SELFIE REJECTED',
            message: isApproved 
                ? 'Congratulations! Your photo identity has been verified by the admin.' 
                : 'Your selfie verification was rejected. Please upload a clearer photo where your face is clearly visible.',
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // 4. Send Email Notification for candidate whose selfie was verified
        try {
            const userEmail = userData?.notificationEmail || userData?.email || userData?.mobileEmail;
            const hasRealEmail = userEmail && userEmail.includes('@') && !userEmail.endsWith('@dbohrarishta.local');

            if (hasRealEmail && isApproved) {
                const { notifyStatusUpdate } = await import('@/lib/emailServiceServer');
                await notifyStatusUpdate({
                    candidateName: userData?.name || 'Candidate',
                    candidateEmail: userEmail,
                    newStatus: 'selfie_verified',
                    adminMessage: 'Congratulations! Your photo identity has been verified by the admin.'
                });
            }
        } catch (emailError: any) {
            console.error('[verify-selfie] Email notification failed:', emailError.message);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[verify-selfie] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
