import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { isEmailBlocked } from '@/lib/emailStatusServer';
import { getOpenChatAnnouncementTemplate } from '@/lib/emailTemplates';
import { sendPushNotificationToUser } from '@/lib/pushNotificationServer';

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
        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const body = await req.json().catch(() => ({}));
        const reminderNote = body.customNote?.trim() || '';

        // Read current open chat settings
        const chatSnap = await adminDb.collection('system_settings').doc('chat_window').get();
        const settings = chatSnap.data() || {};

        const durationLabel = settings.durationLabel || 'Open Now';
        const expiresAt = settings.expiresAt || null;
        const customNote = reminderNote || settings.customNote || '';

        // Query all verified & approved candidates
        const usersSnap = await adminDb.collection('users').get();
        const targetUsers: { id: string; email: string; name?: string }[] = [];

        for (const d of usersSnap.docs) {
            const u = d.data();
            const isVerified = u.status === 'verified' || u.status === 'approved';
            const email = (u.notificationEmail || u.email || '').toString().trim().toLowerCase();

            if (isVerified && email && email.includes('@') && !email.endsWith('@dbohrarishta.local')) {
                targetUsers.push({ id: d.id, email, name: u.name || '' });
            }
        }

        const validEmails: { id: string; email: string; name?: string }[] = [];
        for (const u of targetUsers) {
            const blocked = await isEmailBlocked(u.email);
            if (!blocked) validEmails.push(u);
        }

        let emailsSent = 0;
        let pushSent = 0;

        // 1. Send Email Reminder Blast
        if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && validEmails.length > 0) {
            const html = getOpenChatAnnouncementTemplate({
                durationLabel,
                expiresAt: expiresAt || undefined,
                customNote: customNote || undefined
            });

            const chunkSize = 50;
            for (let i = 0; i < validEmails.length; i += chunkSize) {
                const chunk = validEmails.slice(i, i + chunkSize);
                const bccList = chunk.map(c => c.email).join(', ');

                try {
                    await transporter.sendMail({
                        from: `"53DBohraRishta" <${process.env.GMAIL_USER}>`,
                        to: process.env.GMAIL_USER,
                        bcc: bccList,
                        subject: '✨ Reminder: Direct Chat Window is LIVE! Connect Directly on 53DBohraRishta',
                        html
                    });
                    emailsSent += chunk.length;
                } catch (err) {
                    console.error('Error sending reminder email chunk:', err);
                }
            }
        }

        // 2. Send Real-Time Web & PWA Push Notifications to all verified candidates
        const targetUserIds = validEmails.map(u => u.id);
        if (targetUserIds.length > 0) {
            const pushResult = await sendPushNotificationToUser(targetUserIds, {
                title: '💬 Reminder: Direct Chat Window is LIVE!',
                body: 'All registered and verified candidates can currently chat directly without requiring mutual interest approvals. Take benefit to connect now!',
                url: '/'
            });
            pushSent = pushResult?.totalSuccess || 0;
        }

        // 3. Log into Admin Audit Logs
        await adminDb.collection('admin_audit_logs').add({
            action: 'open_chat_reminder_blast',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            details: `Superadmin sent Open Chat Reminder blast. Emails: ${emailsSent}, Push dispatched to ${targetUserIds.length} verified candidates.`,
            adminEmail: 'superadmin'
        });

        return NextResponse.json({
            success: true,
            verifiedCount: targetUsers.length,
            emailsSent,
            pushSent,
            totalDispatched: targetUserIds.length
        });
    } catch (err: any) {
        console.error('Error in open-chat/remind API:', err);
        return NextResponse.json({ error: err?.message || 'Failed to dispatch reminders' }, { status: 500 });
    }
}
