import * as admin from "firebase-admin";

const initAdmin = () => {
    if (admin.apps.length > 0) return admin.app();

    const projectId = (process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();

    // Only initialize if we have the minimum required credentials
    if (!projectId || !clientEmail || !privateKey) {
        console.warn("⚠️ Firebase Admin credentials missing. Admin features will be disabled.");
        return null;
    }

    try {
        // Clean the private key: replace literal \n and handle potential surrounding quotes
        const cleanedKey = privateKey
            .replace(/^['"]|['"]$/g, '') // Remove redundant outer quotes
            .replace(/\\n/g, "\n");      // Replace escaped newlines

        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: cleanedKey,
            }),
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
    } catch (error: any) {
        console.error("❌ Firebase admin initialization error:", error.message);
        return null;
    }
};

const app = initAdmin();

export const adminAuth = app ? app.auth() : ({} as admin.auth.Auth);
export const adminDb = app ? app.firestore() : ({} as admin.firestore.Firestore);
export const adminStorage = app ? app.storage() : ({} as admin.storage.Storage);
export const adminMessaging = app ? app.messaging() : ({} as admin.messaging.Messaging);
