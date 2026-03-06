import { NextResponse } from 'next/server';
import { adminDb, adminMessaging, adminAuth } from '@/lib/firebase/admin-config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
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

        let pushSuccessCount = 0;
        let pFailCount = 0;
        let emailSuccessCount = 0;
        const emailSet = new Set<string>();

        // Fetch all candidates from Firestore
        const usersSnapshot = await adminDb.collection('users').get();
        const firestoreUsers = usersSnapshot.docs.map(doc => doc.data());
        console.log(`Found ${firestoreUsers.length} users in Firestore.`);

        // 1. Send Push Notifications (FCM)
        if (sendPush) {
            const allTokens = new Set<string>();
            firestoreUsers.forEach(u => {
                if (u.fcmTokens && Array.isArray(u.fcmTokens)) {
                    u.fcmTokens.forEach((t: string) => allTokens.add(t));
                }
            });

            const tokensArray = Array.from(allTokens);
            console.log(`Sending push to ${tokensArray.length} unique tokens.`);

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

        // 2. Prepare Emails
        firestoreUsers.forEach(u => {
            const e = (u.email || '').toString().trim().toLowerCase();
            if (e.includes('@')) emailSet.add(e);
        });

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
            } catch (e) {
                console.error("Error fetching users from Auth:", e);
            }
        }

        const emails = Array.from(emailSet);
        const emailsFound = emails.length;
        console.log(`Collected ${emailsFound} total unique emails for broadcast.`);

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
