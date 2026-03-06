import { NextResponse } from 'next/server';
import { adminDb, adminMessaging, adminAuth } from '@/lib/firebase/admin-config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export async function POST(req: Request) {
    if (!adminDb || !adminMessaging || !adminAuth) {
        return NextResponse.json({ error: 'Firebase Admin not configured. Cannot send broadcasts.' }, { status: 503 });
    }

    try {
        const body = await req.json();
        const { title, message, sendPush, sendInApp, sendEmail, includeAllAuthUsers, adminId } = body;

        console.log(`Starting broadcast: Title="${title}", Push=${sendPush}, Email=${sendEmail}, AllAuth=${includeAllAuthUsers}`);

        // We will collect success counts
        let pushSuccessCount = 0;
        let pFailCount = 0;
        let emailSuccessCount = 0;

        // Fetch all candidates from Firestore
        const usersSnapshot = await adminDb.collection('users').get();
        const firestoreUsers = usersSnapshot.docs.map(doc => doc.data());
        console.log(`Found ${firestoreUsers.length} users in Firestore.`);

        // 1. Send Push Notifications (FCM) - Only works for users with tokens in Firestore
        if (sendPush) {
            // Collect all unique FCM tokens
            const allTokens = new Set<string>();
            firestoreUsers.forEach(u => {
                if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
                    u.fcmTokens.forEach((t: string) => allTokens.add(t));
                }
            });

            const tokensArray = Array.from(allTokens);
            console.log(`Sending push to ${tokensArray.length} unique tokens.`);

            // Firebase limits sendMulticast to 500 tokens at a time
            const chunkSize = 500;
            for (let i = 0; i < tokensArray.length; i += chunkSize) {
                const chunk = tokensArray.slice(i, i + chunkSize);
                if (chunk.length === 0) continue;

                const fcmMessage = {
                    notification: {
                        title: title || 'Admin Announcement',
                        body: message,
                    },
                    tokens: chunk,
                };

                try {
                    const response = await adminMessaging.sendEachForMulticast(fcmMessage);
                    pushSuccessCount += response.successCount;
                    pFailCount += response.failureCount;
                } catch (e) {
                    console.error("FCM broadcast error:", e);
                }
            }
        }

        // 2. Send Emails via NodeMailer
        if (sendEmail) {
            const emailSet = new Set<string>();

            // Add emails from Firestore users
            firestoreUsers.forEach(u => {
                const e = (u.email || '').toString().trim().toLowerCase();
                if (e.includes('@')) emailSet.add(e);
            });

            // If flag enabled, also fetch from Firebase Auth
            if (includeAllAuthUsers) {
                try {
                    console.log("Fetching users from Firebase Auth...");
                    let nextPageToken;
                    do {
                        const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
                        listUsersResult.users.forEach((userRecord) => {
                            if (userRecord.email) {
                                emailSet.add(userRecord.email.toLowerCase().trim());
                            }
                        });
                        nextPageToken = listUsersResult.pageToken;
                    } while (nextPageToken);
                    console.log(`Email set expanded to ${emailSet.size} unique addresses using Auth records.`);
                } catch (e) {
                    console.error("Error fetching users from Auth:", e);
                }
            }

            const emails = Array.from(emailSet);
            console.log(`Collected ${emails.length} total unique emails for broadcast.`);

            if (emails.length > 0 && process.env.GMAIL_USER) {
                // Send in chunks of 50 to avoid SMTP rate limits / spam flags
                const chunkSize = 50;
                for (let i = 0; i < emails.length; i += chunkSize) {
                    const chunk = emails.slice(i, i + chunkSize);

                    const mailOptions = {
                        from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
                        bcc: chunk.join(', '), // BCC so everyone doesn't see each other's emails
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
                        await transporter.sendMail(mailOptions);
                        emailSuccessCount += chunk.length;
                        console.log(`Sent email chunk ${i / chunkSize + 1} successfully.`);
                    } catch (e) {
                        console.error(`Email broadcast error in chunk starting with ${chunk[0]}:`, e);
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            pushSent: pushSuccessCount,
            pushFailed: pFailCount,
            emailsSent: emailSuccessCount
        });

    } catch (error: any) {
        console.error("Broadcast Execution Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
