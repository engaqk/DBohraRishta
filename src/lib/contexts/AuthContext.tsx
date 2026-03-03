"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
    User,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    sendEmailVerification
} from "firebase/auth";
import { auth } from "../firebase/config";

interface AuthContextType {
    user: any | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (e: string, p: string) => Promise<void>;
    signUpWithEmail: (e: string, p: string) => Promise<void>;
    logout: () => Promise<void>;
    setDummyUser: (uid: string, email: string) => void;
    setupRecaptcha: (containerId: string) => void;
    sendOtp: (phoneNumber: string) => Promise<any>;
    verifyOtp: (otp: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    verifyEmail: () => Promise<void>;
    totpQr: { phone: string; qrDataUrl: string; manualKey: string } | null;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [customOtpPayload, setCustomOtpPayload] = useState<{ phone: string; qrDataUrl: string; manualKey: string } | null>(null);

    useEffect(() => {
        const dummyUserStr = localStorage.getItem('dummy_user_id');
        if (dummyUserStr) {
            setUser({ uid: dummyUserStr, email: `${dummyUserStr}@test.com` });
            setLoading(false);
        } else {
            const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                setUser(firebaseUser);
                setLoading(false);
            });
            return () => unsubscribe();
        }
    }, []);

    const setDummyUser = (uid: string, email: string) => {
        localStorage.setItem('dummy_user_id', uid);
        setUser({ uid, email });
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error signing in with Google", error);
            throw error;
        }
    };

    const signInWithEmail = async (email: string, pass: string) => {
        try {
            await signInWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Error signing in with Email", error);
            throw error;
        }
    };

    const signUpWithEmail = async (email: string, pass: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
        } catch (error) {
            console.error("Error signing up with Email", error);
            throw error;
        }
    };

    const logout = async () => {
        try {
            localStorage.removeItem('dummy_user_id');
            await signOut(auth);
            setUser(null);
        } catch (error) {
            console.error("Error signing out", error);
        }
    };

    const setupRecaptcha = (containerId: string) => {
        // Deprecated: Custom fully free OTP implementation no longer natively requires Recaptcha
        console.log("Recaptcha bypassed for completely free Fast2SMS integration.");
    };

    const sendOtp = async (phoneNumber: string) => {
        try {
            const resp = await fetch('/api/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: phoneNumber })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Failed to generate TOTP QR code');

            // Store QR code data for display in login UI
            setCustomOtpPayload({
                phone: phoneNumber,
                qrDataUrl: data.qrDataUrl,
                manualKey: data.manualKey,
            });
            return data;
        } catch (error: any) {
            console.error('Error generating TOTP setup', error);
            throw error;
        }
    };

    const verifyOtp = async (code: string) => {
        if (!customOtpPayload) throw new Error('No pending TOTP session — please enter your phone first');

        try {
            const resp = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: customOtpPayload.phone,
                    code,
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || 'Invalid TOTP code');

            // Sign in to Firebase using deterministic credentials (completely free, no SMS)
            try {
                await signInWithEmailAndPassword(auth, data.internalEmail, data.internalPassword);
            } catch (authError: any) {
                if (
                    authError.message.includes('auth/invalid-credential') ||
                    authError.message.includes('auth/user-not-found') ||
                    authError.message.includes('auth/invalid-login-credentials')
                ) {
                    await createUserWithEmailAndPassword(auth, data.internalEmail, data.internalPassword);
                } else {
                    throw authError;
                }
            }
        } catch (error: any) {
            console.error('Error verifying TOTP', error);
            throw error;
        }
    };

    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
        } catch (error) {
            console.error("Error sending password reset email", error);
            throw error;
        }
    };

    const verifyEmail = async () => {
        if (auth.currentUser) {
            try {
                await sendEmailVerification(auth.currentUser);
            } catch (error) {
                console.error("Error sending verification email", error);
                throw error;
            }
        } else {
            throw new Error("No user is currently logged in.");
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, setDummyUser, setupRecaptcha, sendOtp, verifyOtp, resetPassword, verifyEmail, totpQr: customOtpPayload }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
