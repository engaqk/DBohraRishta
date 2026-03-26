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
        const { userId, newStatus, message, adminId } = body;

        if (!userId || !newStatus) {
            return NextResponse.json({ error: 'userId and newStatus are required' }, { status: 400 });
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
            status: newStatus,
            isItsVerified: newStatus === 'verified' || newStatus === 'approved',
            adminMessage: message || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        batch.update(userRef, updateData);

        // 2. Add system message to thread if needed
        if (message || newStatus === 'rejected' || newStatus === 'hold') {
            const threadRef = adminDb.collection('admin_messages').doc(userId).collection('thread').doc();
            batch.set(threadRef, {
                text: updateData.adminMessage,
                from: 'admin',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        // 3. Log Action in Audit Log
        const auditRef = adminDb.collection('admin_audit_logs').doc();
        batch.set(auditRef, {
            adminId: adminId || 'admin',
            action: 'status_change',
            targetUserId: userId,
            targetUserName: userData?.name || 'Unknown',
            newStatus: newStatus,
            message: updateData.adminMessage,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 4. In-App Notification
        const notifRef = adminDb.collection('users').doc(userId).collection('notifications').doc();
        batch.set(notifRef, {
            type: 'status_update',
            title: 'PROFILE STATUS UPDATED',
            message: `Your profile status is now: ${newStatus.toUpperCase()}. ${updateData.adminMessage ? `Admin says: "${updateData.adminMessage}"` : 'Please check your dashboard for details.'}`,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        // 5. Send Email Notification
        try {
            const userEmail = userData?.notificationEmail || userData?.email || userData?.mobileEmail;
            const hasRealUserEmail = userEmail && userEmail.includes('@') && !userEmail.endsWith('@dbohrarishta.local');
            
            const { notifyStatusUpdate, sendEmailDirect } = await import('@/lib/emailServiceServer');
            const { ADMIN_EMAIL, getNewCandidateVerifiedTemplate } = await import('@/lib/emailTemplates');

            if (hasRealUserEmail) {
                console.log(`[update-status] Sending status update email to ${userEmail} (BCC: ${ADMIN_EMAIL})`);
                await notifyStatusUpdate({
                    candidateName: userData?.name || 'Candidate',
                    candidateEmail: userEmail,
                    newStatus: newStatus,
                    adminMessage: message || ""
                });
            } else {
                console.log(`[update-status] User ${userId} has no real email. Sending status update notification to ADMIN ONLY.`);
                // Notify Admin only if user has no email
                await sendEmailDirect({
                    toEmail: ADMIN_EMAIL,
                    subject: `🚨 User Status Updated (No Email): ${userData?.name || 'Unknown'}`,
                    htmlBody: `
                        <div style="font-family:sans-serif;padding:20px;">
                            <h2>User Status Updated (No Email User)</h2>
                            <p>Admin just updated status for <strong>${userData?.name || 'Unknown Candidate'}</strong>.</p>
                            <p><strong>New Status:</strong> ${newStatus.toUpperCase()}</p>
                            <p><strong>Message:</strong> ${message || 'No message provided.'}</p>
                            <p><em>Note: This user does not have a real email address configured, so they did not receive an email.</em></p>
                            <hr/>
                            <a href="https://53dbohrarishta.in/admin/users">View User in Admin</a>
                        </div>
                    `
                });
            }

            // 6. Broadcast to all verified candidates if NEWLY VERIFIED
            const isNewlyVerified = newStatus === 'verified' || newStatus === 'approved';
            if (isNewlyVerified) {
                console.log(`[update-status] Broadcasting new verified candidate to all existing verified members...`);
                const verifiedUsersSnap = await adminDb.collection('users')
                    .where('status', '==', 'verified')
                    .get();

                const verifiedEmails: string[] = [];
                verifiedUsersSnap.forEach(doc => {
                    const d = doc.data();
                    const email = d.notificationEmail || d.email || d.mobileEmail;
                    if (email && email.includes('@') && !email.endsWith('@dbohrarishta.local') && email !== userEmail) {
                        verifiedEmails.push(email);
                    }
                });

                if (verifiedEmails.length > 0) {
                    console.log(`[update-status] Sending BCC broadcast to ${verifiedEmails.length} verified members.`);
                    await sendEmailDirect({
                        toEmail: ADMIN_EMAIL, // Send to admin, BCC to everyone else
                        bcc: verifiedEmails,
                        subject: `✨ New Profile Verified from ${userData?.city || 'the community'} – 53DBohraRishta`,
                        htmlBody: getNewCandidateVerifiedTemplate({
                            newCandidateGender: userData?.gender || 'unknown',
                            newCandidateCity: userData?.city || userData?.hizratLocation || 'our community'
                        })
                    });
                }
            }

        } catch (emailError: any) {
            console.error('[update-status] Email notification/broadcast process failed:', emailError.message);
        }

        return NextResponse.json({ success: true, updatedUser: { ...userData, ...updateData } });

    } catch (error: any) {
        console.error('[update-status] POST Error:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
