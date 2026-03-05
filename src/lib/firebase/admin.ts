import * as admin from "firebase-admin";

const initAdmin = () => {
    if (admin.apps.length > 0) return admin.app();

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Only initialize if we have the minimum required credentials
    // This prevents build-time crashes on CI/CD platforms like GitHub Actions
    if (!projectId || !clientEmail || !privateKey) {
        console.warn("⚠️ Firebase Admin credentials missing. Admin features will be disabled.");
        return null;
    }

    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, "\n"),
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
