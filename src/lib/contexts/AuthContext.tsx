"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
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
    resetPassword: (email: string) => Promise<void>;
    verifyEmail: () => Promise<void>;
    impersonateUser: (uid: string, email: string) => void;
    stopImpersonating: () => void;
    isImpersonating: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isImpersonating, setIsImpersonating] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            const impersonatedId = localStorage.getItem('impersonated_user_id');
            const dummyUserStr = localStorage.getItem('dummy_user_id');

            if (impersonatedId) {
                setUser({ uid: impersonatedId, email: localStorage.getItem('impersonated_user_email') || 'impersonated@user.com' });
                setIsImpersonating(true);
            } else if (dummyUserStr && !firebaseUser) {
                // Only use dummy if no real user is logged in
                setUser({ uid: dummyUserStr, email: `${dummyUserStr}@test.com` });
            } else {
                setUser(firebaseUser);
                setIsImpersonating(false);
                // If we have a real user, clear dummy state from storage to avoid confusion
                if (firebaseUser) {
                    localStorage.removeItem('dummy_user_id');
                }
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const impersonateUser = (uid: string, email: string) => {
        localStorage.setItem('impersonated_user_id', uid);
        localStorage.setItem('impersonated_user_email', email);
        setUser({ uid, email });
        setIsImpersonating(true);
        // Force redirect to home
        window.location.href = '/';
    };

    const stopImpersonating = () => {
        localStorage.removeItem('impersonated_user_id');
        localStorage.removeItem('impersonated_user_email');
        setIsImpersonating(false);
        // Re-check original auth
        const firebaseUser = auth.currentUser;
        if (firebaseUser) {
            setUser(firebaseUser);
        } else {
            setUser(null);
        }
        window.location.href = '/admin/users';
    };

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


    const resetPassword = async (email: string) => {
        try {
            // continueUrl tells Firebase where to redirect after the user clicks the reset link
            // This must also be added to Firebase Console → Authentication → Authorized domains
            const actionCodeSettings = {
                url: typeof window !== 'undefined'
                    ? `${window.location.origin}/login`
                    : 'https://engaqk.github.io/dbohrarishta/login',
                handleCodeInApp: false,
            };
            await sendPasswordResetEmail(auth, email, actionCodeSettings);
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
        <AuthContext.Provider value={{
            user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail,
            logout, setDummyUser, resetPassword, verifyEmail,
            impersonateUser, stopImpersonating, isImpersonating
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
