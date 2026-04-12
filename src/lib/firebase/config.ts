import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to LOCAL so users stay logged in across page refreshes
// and browser restarts (~1 day session without re-login).
// Guard with typeof window to avoid SSR execution.
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(err =>
    console.warn('Firebase persistence setup error:', err)
  );
}

export const db = getFirestore(app);
export const storage = getStorage(app);
// Initialize Messaging safely
let messagingInternal = null;
if (typeof window !== 'undefined') {
  try {
    // We check if it's supported before even trying to initialize
    // Although isSupported() is async, getMessaging() often throws synchronously if Push API is missing
    messagingInternal = getMessaging(app);
  } catch (e) {
    console.warn('[Firebase] Messaging is not supported in this browser environment:', e);
  }
}

export const messaging = messagingInternal;
