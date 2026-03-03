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
    user: any | null; // Using `any` explicitly to support mocked user objects easily
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
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [customOtpPayload, setCustomOtpPayload] = useState<{ hash: string, expiry: number, phone: string } | null>(null);

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
            if (!resp.ok) throw new Error(data.error || "Failed to send OTP");

            setCustomOtpPayload({ hash: data.hash, expiry: data.expiry, phone: phoneNumber });
            return data; // return so caller can inspect status
        } catch (error: any) {
            console.error("Error sending custom OTP", error);
            throw error;
        }
    };

    const verifyOtp = async (otp: string) => {
        if (!customOtpPayload) throw new Error("No pending OTP request");

        try {
            const resp = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: customOtpPayload.phone,
                    otp,
                    hash: customOtpPayload.hash,
                    expiry: customOtpPayload.expiry
                })
            });

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error || "Failed to verify OTP");

            // Complete Custom Integration: Securely login to Firebase using deterministic internal credentials
            // This is completely free forever.
            try {
                // Try sign in first
                await signInWithEmailAndPassword(auth, data.internalEmail, data.internalPassword);
            } catch (authError: any) {
                // If user doesn't exist internally yet, create the deterministic record!
                if (authError.message.includes('auth/invalid-credential') || authError.message.includes('auth/user-not-found') || authError.message.includes('auth/invalid-login-credentials')) {
                    await createUserWithEmailAndPassword(auth, data.internalEmail, data.internalPassword);
                } else {
                    throw authError; // bubble up
                }
            }

        } catch (error: any) {
            console.error("Error verifying custom OTP", error);
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
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, logout, setDummyUser, setupRecaptcha, sendOtp, verifyOtp, resetPassword, verifyEmail }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
