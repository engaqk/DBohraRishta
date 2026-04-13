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
        const { userId, adminId, isApproved, rejectionReason } = body;

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
            videoStatus: isApproved ? 'verified' : 'rejected',
            videoRejectionReason: isApproved ? null : (rejectionReason || 'Video does not meet community guidelines.'),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.update(userRef, updateData);

        // 2. Log Action in Audit Log
        const auditRef = adminDb.collection('admin_audit_logs').doc();
        batch.set(auditRef, {
            adminId: adminId || 'admin',
            action: 'video_verification',
            targetUserId: userId,
            targetUserName: userData?.name || 'Unknown',
            status: isApproved ? 'verified' : 'rejected',
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. In-App Notification
        const notifRef = adminDb.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'video_verification',
            title: isApproved ? 'VIDEO HANDSHAKE APPROVED' : 'VIDEO REJECTED',
            message: isApproved 
                ? 'Great news! Your video handshake has been approved and is now visible to others.' 
                : `Your video handshake was rejected: ${rejectionReason || 'Please record a clearer video.'}`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // 4. Send Email Notification
        try {
            const userEmail = userData?.notificationEmail || userData?.email || userData?.mobileEmail;
            const hasRealEmail = userEmail && userEmail.includes('@') && !userEmail.endsWith('@dbohrarishta.local');

            if (hasRealEmail) {
                const { notifyVideoHandshakeStatusServer } = await import('@/lib/emailServiceServer');
                await notifyVideoHandshakeStatusServer({
                    candidateName: userData?.name || 'Candidate',
                    candidateEmail: userEmail,
                    status: isApproved ? 'verified' : 'rejected',
                    reason: isApproved ? undefined : rejectionReason
                });
            }
        } catch (emailError: any) {
            console.error('[verify-video] Email notification failed:', emailError.message);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[verify-video] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
