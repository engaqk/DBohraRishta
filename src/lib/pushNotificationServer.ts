import { adminDb, adminMessaging } from './firebase/admin';
import * as admin from 'firebase-admin';

export interface PushNotificationPayload {
    title: string;
    body: string;
    url?: string;
    data?: Record<string, string>;
}

/**
 * Builds standard cross-platform FCM multicast payload with Web, Android, and iOS specifics.
 */
function buildFcmPayload(tokens: string[], payload: PushNotificationPayload, targetUrl: string) {
    return {
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
            headers: {
                Urgency: 'high'
            },
            notification: {
                title: payload.title,
                body: payload.body,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                vibrate: [200, 100, 200],
                requireInteraction: true
            }
        },
        android: {
            priority: 'high' as const,
            notification: {
                title: payload.title,
                body: payload.body,
                icon: 'ic_launcher',
                color: '#881337',
                sound: 'default',
                clickAction: targetUrl,
                defaultSound: true,
                defaultVibrateTimings: true
            }
        },
        apns: {
            headers: {
                'apns-priority': '10'
            },
            payload: {
                aps: {
                    alert: {
                        title: payload.title,
                        body: payload.body,
                    },
                    sound: 'default',
                    badge: 1
                }
            }
        }
    };
}

/**
 * Dispatches push notification directly to an array of FCM tokens.
 * Handles automatic chunking (500 tokens max per FCM multicast batch).
 */
export async function sendPushNotificationToTokens(
    tokens: string[],
    payload: PushNotificationPayload
): Promise<{ success: boolean; successCount: number; failureCount: number; staleTokens: string[] }> {
    if (!adminMessaging || typeof adminMessaging.sendEachForMulticast !== 'function') {
        console.warn('[PushServer] adminMessaging not initialized.');
        return { success: false, successCount: 0, failureCount: 0, staleTokens: [] };
    }

    const uniqueTokens = Array.from(new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 10)));
    if (uniqueTokens.length === 0) {
        return { success: true, successCount: 0, failureCount: 0, staleTokens: [] };
    }

    const targetUrl = payload.url || '/';
    let totalSuccess = 0;
    let totalFailure = 0;
    const staleTokens: string[] = [];

    // Chunk into batches of 500
    const CHUNK_SIZE = 500;
    for (let i = 0; i < uniqueTokens.length; i += CHUNK_SIZE) {
        const batchTokens = uniqueTokens.slice(i, i + CHUNK_SIZE);
        try {
            const fcmPayload = buildFcmPayload(batchTokens, payload, targetUrl);
            const response = await adminMessaging.sendEachForMulticast(fcmPayload);
            totalSuccess += response.successCount;
            totalFailure += response.failureCount;

            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const errCode = resp.error.code;
                    if (
                        errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered'
                    ) {
                        staleTokens.push(batchTokens[idx]);
                    }
                }
            });
        } catch (batchErr) {
            console.error('[PushServer] Error dispatching batch multicast:', batchErr);
            totalFailure += batchTokens.length;
        }
    }

    return {
        success: true,
        successCount: totalSuccess,
        failureCount: totalFailure,
        staleTokens
    };
}

/**
 * Sends a real-time web & mobile push notification to one or multiple user IDs
 * using Firebase Cloud Messaging (FCM) and records an in-app notification.
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
    if (ids.length === 0) return { success: true, count: 0, totalSuccess: 0, totalFailure: 0 };

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

            // 2. Fetch user's registered FCM tokens
            const userSnap = await adminDb.collection('users').doc(uid).get();
            if (!userSnap.exists) continue;

            const userData = userSnap.data();
            const rawTokens: string[] = Array.isArray(userData?.fcmTokens) ? userData.fcmTokens : [];
            const tokens = Array.from(new Set(rawTokens.filter(t => typeof t === 'string' && t.trim().length > 10)));

            if (tokens.length === 0) continue;

            // 3. Dispatch FCM multicast
            const dispatchResult = await sendPushNotificationToTokens(tokens, payload);
            totalSuccess += dispatchResult.successCount;
            totalFailure += dispatchResult.failureCount;

            // 4. Automatically clean up stale tokens from user document
            if (dispatchResult.staleTokens.length > 0) {
                await adminDb.collection('users').doc(uid).update({
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...dispatchResult.staleTokens)
                });
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
    const emailList = Array.isArray(emails) ? emails : [emails];
    if (emailList.length === 0) return { success: true, sent: 0 };

    try {
        const userIds: string[] = [];
        const CHUNK_SIZE = 30; // Firestore 'in' limit is 30
        for (let i = 0; i < emailList.length; i += CHUNK_SIZE) {
            const chunk = emailList.slice(i, i + CHUNK_SIZE).map(e => e.toLowerCase().trim());
            const snaps = await adminDb.collection('users').where('email', 'in', chunk).get();
            snaps.forEach(doc => userIds.push(doc.id));
        }

        if (userIds.length === 0) {
            return { success: true, sent: 0, reason: 'No matching user IDs found for emails' };
        }

        return await sendPushNotificationToUser(userIds, payload);
    } catch (err) {
        console.error('[PushServer] Error sending push by email:', err);
        return { success: false, error: err };
    }
}
