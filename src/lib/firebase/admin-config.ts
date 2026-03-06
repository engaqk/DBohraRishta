import * as admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
    try {
        const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

        if (serviceAccountStr) {
            // Decode if base64, or parse direct JSON string
            const serviceAccount = JSON.parse(
                // Quick check if it looks like base64 instead of JSON
                serviceAccountStr.startsWith('{')
                    ? serviceAccountStr
                    : Buffer.from(serviceAccountStr, 'base64').toString('utf8')
            );

            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log('Firebase Admin initialized successfully.');
        } else {
            console.warn('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Push notifications and admin backend features require this.');
        }
    } catch (error) {
        console.error('Firebase Admin initialization error:', error);
    }
}

export const adminDb = admin.apps.length ? admin.firestore() : null;
export const adminMessaging = admin.apps.length ? admin.messaging() : null;
export const adminAuth = admin.apps.length ? admin.auth() : null;
