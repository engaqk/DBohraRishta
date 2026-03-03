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
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
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
    sendOtp: (phoneNumber: string) => Promise<void>;
    verifyOtp: (otp: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    verifyEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

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
        if (!recaptchaVerifier) {
            const verifier = new RecaptchaVerifier(auth, containerId, {
                size: 'invisible',
            });
            setRecaptchaVerifier(verifier);
        }
    };

    const sendOtp = async (phoneNumber: string) => {
        if (!recaptchaVerifier) throw new Error("Recaptcha not initialized");
        try {
            const result = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
            setConfirmationResult(result);
        } catch (error) {
            console.error("Error sending OTP", error);
            throw error;
        }
    };

    const verifyOtp = async (otp: string) => {
        if (!confirmationResult) throw new Error("No pending OTP request");
        try {
            await confirmationResult.confirm(otp);
        } catch (error) {
            console.error("Error verifying OTP", error);
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
