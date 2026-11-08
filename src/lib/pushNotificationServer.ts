import { adminDb, adminMessaging } from './firebase/admin';
import * as admin from 'firebase-admin';

export interface PushNotificationPayload {
    title: string;
    body: string;
    url?: string;
    data?: Record<string, string>;
}

/**
 * Sends a real-time web & PWA push notification to one or multiple users
 * using Firebase Cloud Messaging (FCM) and simultaneously records an in-app notification.
 */
export async function sendPushNotificationToUser(
    userIds: string | string[],
    payload: PushNotificationPayload
) {
    if (!adminDb) {
        console.warn('[PushServer] adminDb not initialized. Cannot send push notification.');
        return { success: false, reason: 'adminDb unavailable' };
    }

    const ids = Array.isArray(userIds) ? userIds : [userIds];
    if (ids.length === 0) return { success: true, count: 0 };

    const targetUrl = payload.url || '/';
    let totalSuccess = 0;
    let totalFailure = 0;

    for (const uid of ids) {
        try {
            // 1. Create in-app notification in Firestore subcollection
            await adminDb.collection('users').doc(uid).collection('notifications').add({
                title: payload.title,
                body: payload.body,
                link: targetUrl,
                data: payload.data || {},
                unread: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Fetch user's registered FCM tokens (web browsers & PWA apps)
            const userSnap = await adminDb.collection('users').doc(uid).get();
            if (!userSnap.exists) continue;

            const userData = userSnap.data();
            const tokens: string[] = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens : [];

            if (tokens.length === 0 || !adminMessaging || typeof adminMessaging.sendEachForMulticast !== 'function') {
                continue;
            }

            // 3. Dispatch FCM multicast
            const fcmPayload = {
                tokens,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: {
                    ...(payload.data || {}),
                    title: payload.title,
                    body: payload.body,
                    url: targetUrl,
                },
                webpush: {
                    fcmOptions: {
                        link: targetUrl
                    },
                    notification: {
                        title: payload.title,
                        body: payload.body,
                        icon: '/icon-192.png',
                        badge: '/icon-192.png'
                    }
                }
            };

            const response = await adminMessaging.sendEachForMulticast(fcmPayload);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            // 4. Automatically clean up invalid/stale tokens
            if (response.failureCount > 0) {
                const staleTokens: string[] = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errCode = resp.error.code;
                        if (
                            errCode === 'messaging/invalid-registration-token' ||
                            errCode === 'messaging/registration-token-not-registered'
                        ) {
                            staleTokens.push(tokens[idx]);
                        }
                    }
                });

                if (staleTokens.length > 0) {
                    await adminDb.collection('users').doc(uid).update({
                        fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens)
                    });
                }
            }
        } catch (err) {
            console.error(`[PushServer] Error sending push to user ${uid}:`, err);
        }
    }

    return { success: true, totalSuccess, totalFailure };
}

/**
 * Sends a real-time push notification to all platform administrators
 */
export async function notifyAdmins(payload: PushNotificationPayload) {
    if (!adminDb) return { success: false };
    try {
        const adminSnaps = await adminDb.collection('users').where('role', '==', 'admin').get();
        const adminIds: string[] = [];
        adminSnaps.forEach(doc => adminIds.push(doc.id));

        // Always include default admin UID if known
        if (adminIds.length === 0) {
            adminIds.push('admin-panel-service-account');
        }

        return await sendPushNotificationToUser(adminIds, payload);
    } catch (err) {
        console.error('[PushServer] Error notifying admins:', err);
        return { success: false };
    }
}

/**
 * Resolves user IDs from recipient emails and simultaneously dispatches real-time push notifications
 */
export async function sendPushByEmail(
    emails: string | string[],
    payload: PushNotificationPayload
) {
    if (!adminDb) return { success: false };
    const emailList = (Array.isArray(emails) ? emails : [emails])
        .filter(e => e && typeof e === 'string' && e.includes('@') && !e.endsWith('@dbohrarishta.local'))
        .map(e => e.trim().toLowerCase());

    if (emailList.length === 0) return { success: true, count: 0 };

    const targetUserIds = new Set<string>();

    for (const email of emailList) {
        try {
            const snap1 = await adminDb.collection('users').where('email', '==', email).limit(5).get();
            snap1.forEach(d => targetUserIds.add(d.id));

            const snap2 = await adminDb.collection('users').where('notificationEmail', '==', email).limit(5).get();
            snap2.forEach(d => targetUserIds.add(d.id));
        } catch (e) {
            console.error('[PushServer] Error looking up user by email:', email, e);
        }
    }

    if (targetUserIds.size > 0) {
        return await sendPushNotificationToUser(Array.from(targetUserIds), payload);
    }

    return { success: true, count: 0 };
}
