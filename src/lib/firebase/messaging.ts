import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { messaging, db } from './config';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';

/**
 * Web Push Certificate Key (VAPID Key) for Firebase Project dbohranisbat
 */
export const VAPID_KEY = 'BIxYKJCTw4FWuOzFcbcGcm8JnileE2bsJtE_F0PJVILaqGmhzL5wUifgCFMFLB1RRpJsaIdCmQnmrXTiXh52om8';

/**
 * Plays a clean, pleasant 2-tone audio chime via Web Audio API without needing external sound files.
 */
export function playNotificationChime() {
    if (typeof window === 'undefined') return;
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        // Pleasant ascending melody (D5 -> A5)
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.45);
    } catch (e) {
        // Audio might be constrained until user gesture
    }
}

/**
 * Request notification permission and register FCM device token to Firestore.
 * Explicitly registers /firebase-messaging-sw.js for 100% reliability on Web, PWA, and Mobile WebView.
 */
export async function requestNotificationPermission(userId?: string): Promise<{ success: boolean; token?: string; reason?: string }> {
    if (typeof window === 'undefined') {
        return { success: false, reason: 'SSR environment' };
    }

    if (!('Notification' in window)) {
        console.warn('[Messaging] Push notifications are not supported by this browser.');
        return { success: false, reason: 'Notifications not supported' };
    }

    const supported = await isSupported();
    const m = messaging;

    if (!m || !supported) {
        console.warn('[Messaging] Messaging not supported or not initialized.');
        return { success: false, reason: 'Firebase messaging not supported' };
    }

    try {
        console.log('[Messaging] Requesting user permission...');
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            console.warn('[Messaging] Notification permission was denied or dismissed.');
            return { success: false, reason: 'Permission denied by user' };
        }

        console.log('[Messaging] Notification permission granted. Registering service worker...');

        // Explicitly register /firebase-messaging-sw.js for full cross-platform compatibility
        let swRegistration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
            try {
                swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
                await navigator.serviceWorker.ready;
                console.log('[Messaging] Service worker active with scope:', swRegistration.scope);
            } catch (swErr) {
                console.warn('[Messaging] Service worker registration warning:', swErr);
            }
        }

        // Generate FCM Token using explicit serviceWorkerRegistration and VAPID key
        const token = await getToken(m, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: swRegistration
        });

        if (!token) {
            console.warn('[Messaging] Failed to generate FCM token.');
            return { success: false, reason: 'No token generated' };
        }

        console.log('[Messaging] Generated FCM Token successfully:', token.substring(0, 20) + '...');

        // If a userId is provided, save the token to the user document
        if (userId) {
            await setDoc(doc(db, 'users', userId), {
                fcmTokens: arrayUnion(token),
                fcmLastUpdated: new Date().toISOString()
            }, { merge: true });
            console.log('[Messaging] Token persisted in Firestore for user:', userId);
        }

        // Also save token in localStorage for quick client-side test identification
        try {
            localStorage.setItem('dbohra_fcm_token', token);
        } catch (e) { }

        return { success: true, token };
    } catch (error: any) {
        console.error('[Messaging] Error requesting notification permission:', error);
        return { success: false, reason: error?.message || 'Unknown error' };
    }
}

/**
 * Subscribes to foreground push notifications and executes the callback.
 */
export function subscribeForegroundMessages(onReceive: (payload: any) => void): (() => void) | null {
    if (typeof window === 'undefined') return null;
    const m = messaging;
    if (!m) return null;

    try {
        const unsubscribe = onMessage(m, (payload) => {
            console.log('[Messaging] Foreground push received:', payload);
            playNotificationChime();
            onReceive(payload);
        });
        return unsubscribe;
    } catch (err) {
        console.warn('[Messaging] Failed to attach onMessage listener:', err);
        return null;
    }
}

/**
 * Legacy listener promise for backward compatibility
 */
export async function onMessageListener() {
    const supported = typeof window !== 'undefined' && await isSupported();
    const m = messaging;
    if (!m || !supported) return null;

    return new Promise((resolve) => {
        onMessage(m, (payload) => {
            playNotificationChime();
            resolve(payload);
        });
    });
}
