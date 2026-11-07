import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { isEmailBlocked } from '@/lib/emailStatusServer';
import { getOpenChatAnnouncementTemplate } from '@/lib/emailTemplates';

export const dynamic = 'force-dynamic';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
    },
});

export async function GET(req: Request) {
    try {
        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const docRef = adminDb.collection('system_settings').doc('chat_window');
        const snap = await docRef.get();

        if (!snap.exists) {
            return NextResponse.json({
                success: true,
                settings: {
                    isOpenChatActive: false,
                    expiresAt: null,
                    enabledAt: null,
                    durationHours: null,
                    durationLabel: 'Until Manually Disabled'
                }
            });
        }

        const data = snap.data() || {};
        // Check if expired
        let isExpired = false;
        if (data.isOpenChatActive && data.expiresAt) {
            const expTime = new Date(data.expiresAt).getTime();
            if (Date.now() > expTime) {
                isExpired = true;
                // Auto-disable if expired
                await docRef.update({
                    isOpenChatActive: false,
                    expiredAuto: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                data.isOpenChatActive = false;
            }
        }

        return NextResponse.json({
            success: true,
            settings: {
                ...data,
                isOpenChatActive: isExpired ? false : !!data.isOpenChatActive
            }
        });
    } catch (e: any) {
        console.error('Error fetching chat window settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== 'secure_admin_session_active') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 503 });
        }

        const body = await req.json();
        const { enabled, durationHours, durationLabel, sendEmail, customNote } = body;

        const docRef = adminDb.collection('system_settings').doc('chat_window');

        if (enabled) {
            const enabledAt = new Date().toISOString();
            let expiresAt: string | null = null;
            if (durationHours && Number(durationHours) > 0) {
                expiresAt = new Date(Date.now() + Number(durationHours) * 3600 * 1000).toISOString();
            }

            const cleanDurationLabel = durationLabel || (durationHours ? `${durationHours} Hours` : 'Until Manually Disabled');

            await docRef.set({
                isOpenChatActive: true,
                enabledAt,
                expiresAt,
                durationHours: durationHours ? Number(durationHours) : null,
                durationLabel: cleanDurationLabel,
                customNote: customNote || '',
                updatedBy: 'admin',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Audit log
            await adminDb.collection('admin_audit_logs').add({
                action: 'OPEN_CHAT_ENABLED',
                details: `Superadmin enabled Open Chat Window. Duration: ${cleanDurationLabel}. Email blast: ${sendEmail ? 'YES' : 'NO'}.`,
                admin: 'admin',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            let emailsSent = 0;
            let verifiedCount = 0;

            if (sendEmail) {
                // Fetch verified & approved users ONLY
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

                verifiedCount = targetUsers.length;

                // Filter non-blocked emails
                const validEmails: { id: string; email: string; name?: string }[] = [];
                for (const u of targetUsers) {
                    const blocked = await isEmailBlocked(u.email);
                    if (!blocked) {
                        validEmails.push(u);
                    }
                }

                if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && validEmails.length > 0) {
                    const html = getOpenChatAnnouncementTemplate({
                        durationLabel: cleanDurationLabel,
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
                                subject: '✨ Special Open Chat Window is LIVE! Connect Directly on 53DBohraRishta',
                                html
                            });
                            emailsSent += chunk.length;
                        } catch (err) {
                            console.error('Error sending open chat announcement email chunk:', err);
                        }
                    }
                }

                // Create in-app notification for each verified user
                const notifPromises = validEmails.slice(0, 300).map(u => {
                    return adminDb.collection('users').doc(u.id).collection('notifications').add({
                        type: 'open_chat_announcement',
                        title: '✨ Special Open Chat Window is LIVE!',
                        message: `Direct messaging is currently open for all verified candidates! Take benefit to connect directly with your prospective matches as soon as possible${durationHours ? ` (Open for the next ${cleanDurationLabel})` : ''}. Please maintain noble intentions, respectful adab, and represent yourself honorably.`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        isRead: false
                    }).catch(() => null);
                });
                await Promise.allSettled(notifPromises);
            }

            return NextResponse.json({
                success: true,
                isOpenChatActive: true,
                expiresAt,
                durationLabel: cleanDurationLabel,
                emailsSent,
                verifiedCount
            });
        } else {
            // Disabled
            await docRef.set({
                isOpenChatActive: false,
                disabledAt: new Date().toISOString(),
                expiresAt: null,
                updatedBy: 'admin',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            await adminDb.collection('admin_audit_logs').add({
                action: 'OPEN_CHAT_DISABLED',
                details: 'Superadmin disabled Open Chat Window. Reverted to strict interest approval mode.',
                admin: 'admin',
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return NextResponse.json({
                success: true,
                isOpenChatActive: false
            });
        }
    } catch (e: any) {
        console.error('Error updating chat window settings:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
