import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from './config';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

/**
 * Request permission for push notifications and save the device token to Firestore.
 * 
 * IMPORTANT: To enable push notifications on production (web), you MUST:
 * 1. Go to Firebase Console > Project Settings > Cloud Messaging.
 * 2. Generate a 'Web Push Certificate' Key (VAPID Key).
 * 3. Copy the 'Key Pair' string and paste it into the 'vapidKey' variable below.
 */
const VAPID_KEY = 'BIxYKJCTw4FWuOzFcbcGcm8JnileE2bsJtE_F0PJVILaqGmhzL5wUifgCFMFLB1RRpJsaIdCmQnmrXTiXh52om8'; // <-- PASTE YOUR FIREBASE VAPID KEY HERE

export async function requestNotificationPermission(userId: string) {
    const m = messaging;
    if (!m) {
        console.warn('[Messaging] Messaging not supported in this browser environment.');
        return;
    }

    try {
        console.log('[Messaging] Requesting permission...');
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('[Messaging] Notification permission granted.');

            // Get registration token
            const token = await getToken(m, {
                vapidKey: VAPID_KEY || undefined
            });

            if (token) {
                console.log('[Messaging] Token generated:', token);
                await updateDoc(doc(db, "users", userId), {
                    fcmTokens: arrayUnion(token)
                });
                console.log('[Messaging] Token saved to user profile in Firestore.');
            } else {
                console.warn('[Messaging] No registration token available. Request permission to generate one.');
            }
        } else {
            console.warn('[Messaging] Notification permission denied.');
        }
    } catch (error) {
        console.error('[Messaging] Error getting notification permission:', error);
    }
}

export function onMessageListener() {
    const m = messaging;
    if (!m) return null;
    return new Promise((resolve) => {
        onMessage(m, (payload) => {
            console.log('[Messaging] Foreground message received:', payload);
            resolve(payload);
        });
    });
}
