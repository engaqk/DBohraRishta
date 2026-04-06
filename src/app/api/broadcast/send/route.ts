import { NextResponse } from 'next/server';
import { adminDb, adminMessaging, adminAuth } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';
import * as admin from 'firebase-admin';
import { isEmailBlocked } from '@/lib/emailStatusServer';

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb || !adminMessaging || !adminAuth) {
            return NextResponse.json({ error: 'Firebase Admin not configured. Cannot send broadcasts.' }, { status: 503 });
        }

        const body = await req.json();
        const { title, message, sendPush, sendInApp, sendEmail, includeAllAuthUsers, onlyIncompleteOnboarding, adminId, preview } = body;

        // ... (Later in the route, we'll return early if preview is true)
        const broadcastData = {
            title: title || "Platform Update",
            message: message,
            adminId: adminId || 'admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            delivery: {
                push: !!sendPush,
                inApp: !!sendInApp,
                email: !!sendEmail
            },
            targeting: {
                allAuth: !!includeAllAuthUsers,
                onlyIncomplete: !!onlyIncompleteOnboarding
            }
        };

        if (preview) {
            console.log(`PREVIEWING target counts (OnlyIncomplete=${onlyIncompleteOnboarding})...`);
        } else {
            const broadcastRef = await adminDb.collection('broadcasts').add(broadcastData);
            console.log(`Starting broadcast record=${broadcastRef.id}: Title="${title}", OnlyIncomplete=${onlyIncompleteOnboarding}`);
        }

        let pushSuccessCount = 0;
        let pFailCount = 0;
        let emailSuccessCount = 0;
        const emailSet = new Set<string>();

        // Fetch all candidates from Firestore
        const usersSnapshot = await adminDb.collection('users').get();
        const firestoreUsers = usersSnapshot.docs.map(doc => doc.data());
        console.log(`Found ${firestoreUsers.length} users in Firestore.`);

        // Helper to identify complete vs incomplete
        const completedEmailSet = new Set<string>();
        firestoreUsers.forEach(u => {
            const isComplete = u.isCandidateFormComplete || u.status === 'verified' || u.status === 'approved';
            if (isComplete && u.email) completedEmailSet.add(u.email.toLowerCase().trim());
        });

        // 1. Push Notifications
        if (sendPush) {
            const pushTokens = new Set<string>();
            firestoreUsers.forEach(u => {
                const isComplete = u.isCandidateFormComplete || u.status === 'verified' || u.status === 'approved';
                if (onlyIncompleteOnboarding && isComplete) return; // Skip complete ones

                if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
                    u.fcmTokens.forEach((t: string) => pushTokens.add(t));
                }
            });

            const tokensArray = Array.from(pushTokens);
            if (tokensArray.length > 0) {
                console.log(`Sending push to ${tokensArray.length} tokens (OnlyIncomplete=${onlyIncompleteOnboarding})`);
                const chunkSize = 500;
                for (let i = 0; i < tokensArray.length; i += chunkSize) {
                    const chunk = tokensArray.slice(i, i + chunkSize);
                    const fcmMessage = {
                        notification: { title: title || 'Admin Announcement', body: message },
                        tokens: chunk,
                    };
                    try {
                        const response = await adminMessaging.sendEachForMulticast(fcmMessage);
                        pushSuccessCount += response.successCount;
                        pFailCount += response.failureCount;
                    } catch (e) {
                        console.error("FCM error:", e);
                    }
                }
            }
        }

        // 2. Prepare Emails
        firestoreUsers.forEach(u => {
            const e = (u.email || '').toString().trim().toLowerCase();
            if (e.includes('@')) {
                const isComplete = u.isCandidateFormComplete || u.status === 'verified' || u.status === 'approved';
                if (onlyIncompleteOnboarding && isComplete) return; // Skip complete ones
                emailSet.add(e);
            }
        });

        if (includeAllAuthUsers || onlyIncompleteOnboarding) {
            try {
                let nextPageToken;
                do {
                    const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
                    listUsersResult.users.forEach((userRecord) => {
                        if (userRecord.email) {
                            const email = userRecord.email.toLowerCase().trim();
                            // If targeting ONLY incomplete, skip those who have completed in Firestore
                            if (onlyIncompleteOnboarding && completedEmailSet.has(email)) return;
                            emailSet.add(email);
                        }
                    });
                    nextPageToken = listUsersResult.pageToken;
                } while (nextPageToken);
            } catch (e) {
                console.error("Error fetching users from Auth:", e);
            }
        }

        const allEmails = Array.from(emailSet);
        const emailsFound = allEmails.length;
        console.log(`Found ${emailsFound} total unique emails for broadcast. Filtering blocked...`);

        // 🛡️ Filter blocked emails
        const emails: string[] = [];
        for (const email of allEmails) {
            if (!(await isEmailBlocked(email))) {
                emails.push(email);
            }
        }
        
        console.log(`Sending to ${emails.length} active (non-blocked) emails.`);

        if (preview) {
            return NextResponse.json({
                success: true,
                preview: true,
                emailsFound: emailsFound,
                activeEmails: emails.length,
            });
        }

        // 3. Send Emails
        if (sendEmail) {
            if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
                console.error("CRITICAL: GMAIL_USER or GMAIL_APP_PASSWORD missing.");
                return NextResponse.json({
                    success: false,
                    error: "Email credentials missing on server. Set GMAIL_USER/GMAIL_APP_PASSWORD in Vercel.",
                    emailsFound
                }, { status: 500 });
            }

            if (emailsFound > 0) {
                const chunkSize = 50;
                for (let i = 0; i < emails.length; i += chunkSize) {
                    const chunk = emails.slice(i, i + chunkSize);
                    const mailOptions = {
                        from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
                        to: process.env.GMAIL_USER, // Gmail often requires a 'To' address even when using BCC
                        bcc: chunk.join(', '),
                        subject: title || 'Platform Announcement',
                        html: `
                            <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 30px;">
                                <div style="max-w: 600px; margin: auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                                    <div style="background-color: #881337; color: white; padding: 20px; text-align: center;">
                                        <h2 style="margin: 0;">53DBohraRishta Announcement</h2>
                                    </div>
                                    <div style="padding: 30px; color: #374151;">
                                        <h3 style="margin-top: 0; color: #111827;">${title || 'Important Message'}</h3>
                                        <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
                                    </div>
                                    <div style="background-color: #f3f4f6; padding: 15px; text-align: center; color: #9ca3af; font-size: 12px;">
                                        &copy; ${new Date().getFullYear()} 53DBohraRishta Online Community
                                    </div>
                                </div>
                            </div>
                        `,
                    };

                    try {
                        console.log(`Sending email chunk ${i / chunkSize + 1} to ${chunk.length} recipients...`);
                        await transporter.sendMail(mailOptions);
                        emailSuccessCount += chunk.length;
                    } catch (e: any) {
                        console.error(`Email error:`, e);
                        // Return error immediately so we can see what's wrong
                        return NextResponse.json({
                            success: false,
                            error: "Email sending failed: " + (e.message || "Unknown SMTP Error"),
                            emailsSent: emailSuccessCount,
                            emailsFound
                        }, { status: 500 });
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            pushSent: pushSuccessCount,
            pushFailed: pFailCount,
            emailsSent: emailSuccessCount,
            emailsFound: emailsFound
        });

    } catch (error: any) {
        console.error("CRITICAL BROADCAST ERROR:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "Unknown Server Error",
            details: error.stack
        }, { status: 500 });
    }
}
