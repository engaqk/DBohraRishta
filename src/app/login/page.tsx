"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Heart, Mail, Lock, Phone, Smartphone, Copy, CheckCircle, Loader2, MessageSquare, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { QRCodeSVG } from "qrcode.react";
import * as OTPAuth from "otpauth";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

// ─── Client-side TOTP helpers ────────────────────────────────────────────────

const TOTP_LABEL = "DBohraRishta";

function deriveBase32Secret(phone: string): string {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const PEPPER = "dbohra_totp_pepper_v1";
    const input = `${PEPPER}:${clean}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) - hash) + input.charCodeAt(i);
        hash |= 0;
    }
    const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let seed = Math.abs(hash);
    let out = "";
    for (let i = 0; i < 32; i++) {
        const charCode = clean.charCodeAt(i % clean.length) || 1;
        const index = ((seed ^ charCode ^ (i * 31)) >>> 0) % 32;
        out += B32[index];
        seed = ((seed * 1664525) + 1013904223) >>> 0;
    }
    return out;
}

function buildOtpAuthUrl(phone: string, secret: string): string {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const totp = new OTPAuth.TOTP({
        issuer: TOTP_LABEL,
        label: clean,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
    });
    return totp.toString();
}

function verifyTOTP(secret: string, code: string): boolean {
    try {
        const totp = new OTPAuth.TOTP({
            issuer: TOTP_LABEL,
            algorithm: "SHA1",
            digits: 6,
            period: 30,
            secret: OTPAuth.Secret.fromBase32(secret),
        });
        return totp.validate({ token: code, window: 1 }) !== null;
    } catch { return false; }
}

function phoneToFirebaseCredentials(phone: string) {
    const clean = phone.replace(/[\s\-\+()]/g, '');
    const internalEmail = `p${clean}@dbohra.app`;
    const SALT = "fb_salt_dbohra_v2_2026";
    let hash = 5381;
    const input = SALT + clean;
    for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash |= 0;
    }
    const internalPassword = "Db" + Math.abs(hash).toString(36).padStart(10, "0").substring(0, 18);
    return { internalEmail, internalPassword };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, setDummyUser, resetPassword } = useAuth();
    const router = useRouter();

    type AuthTab = "email" | "totp"; // "phone" is hidden (billing required) but code is kept
    const [authMode, setAuthMode] = useState<AuthTab>("totp");

    // Email tab state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    // TOTP tab state
    const [totpPhone, setTotpPhone] = useState("+91");
    const [totpCode, setTotpCode] = useState("");
    const [qrShown, setQrShown] = useState(false);
    const [qrUrl, setQrUrl] = useState("");
    const [manualKey, setManualKey] = useState("");
    const [keyCopied, setKeyCopied] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(false);

    // Firebase Phone Auth (SMS) tab state — HIDDEN (requires Blaze billing), code kept for future use
    const [smsPhone, setSmsPhone] = useState("+91");
    const [smsCode, setSmsCode] = useState("");
    const [smsSent, setSmsSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

    // Shared
    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Detect if running on a mobile/touch device
    useEffect(() => {
        setIsMobileDevice(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    }, []);

    useEffect(() => {
        const checkUserStatus = async () => {
            if (!loading && user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    router.push(userDoc.exists() ? "/" : "/onboarding");
                } catch { router.push("/onboarding"); }
            }
        };
        checkUserStatus();
    }, [user, loading, router]);

    const switchTab = (tab: AuthTab) => {
        setAuthMode(tab);
        setErrorMsg("");
    };

    // ── Email Auth ────────────────────────────────────────────────────────────
    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        if (isResettingPassword) {
            if (!email) { setErrorMsg("Please enter your email."); return; }
            setAuthLoading(true);
            try {
                await resetPassword(email);
                toast.success("Password reset email sent!");
                setIsResettingPassword(false);
            } catch (error: any) {
                setErrorMsg(error.message.replace("Firebase: ", ""));
            } finally { setAuthLoading(false); }
            return;
        }
        if (!email || !password) { setErrorMsg("Please enter email and password."); return; }

        // Admin credentials bypass
        if (email.toLowerCase() === 'admin' && password === 'admin53') {
            setAuthLoading(true);
            try {
                // We create a dummy authenticated state or sign in using a hardcoded firebase email 
                // Alternatively, intercept at the AuthContext level or use hardcoded email.
                // Assuming we have to map "admin" to a real firebase email
                await signInWithEmail('abdulqadirkhanji52@gmail.com', password); // Admin mapping example
                toast.success("Welcome Admin!");
                router.push("/admin");
                return;
            } catch {
                toast.error("Admin account error. Please ensure Firebase has this admin configured or use correct password.");
                try {
                    await signInWithEmail('admin@dbohranisbat.com', password);
                } catch (e: any) {
                    setErrorMsg(e.message);
                }
            } finally {
                setAuthLoading(false);
            }
            return;
        }

        if (isRegistering && password.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }
        setAuthLoading(true);
        try {
            if (isRegistering) {
                await signUpWithEmail(email, password);
                toast.success("Account created! Admin verification pending.");
            } else {
                await signInWithEmail(email, password);
            }
        } catch (error: any) {
            setErrorMsg(error.message.replace("Firebase: ", ""));
        } finally { setAuthLoading(false); }
    };

    // ── TOTP: Step 1 — Generate QR ────────────────────────────────────────────
    const handleGenerateQr = () => {
        const clean = totpPhone.replace(/[\s\-()]/g, '');
        if (!clean || clean.length < 10 || !clean.startsWith('+')) {
            setErrorMsg("Enter a valid number with country code, e.g. +919876543210");
            return;
        }
        setErrorMsg("");
        const secret = deriveBase32Secret(totpPhone);
        setManualKey(secret);
        setQrUrl(buildOtpAuthUrl(totpPhone, secret));
        setQrShown(true);
    };

    // ── TOTP: Step 2 — Verify code and sign in ────────────────────────────────
    const handleVerifyTotp = async () => {
        if (!totpCode || totpCode.length !== 6) {
            setErrorMsg("Enter the 6-digit code from your authenticator app.");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        const secret = deriveBase32Secret(totpPhone);
        if (!verifyTOTP(secret, totpCode)) {
            setErrorMsg("Incorrect code. Make sure your phone clock is synced and try the latest code shown.");
            setAuthLoading(false);
            return;
        }
        try {
            const { internalEmail, internalPassword } = phoneToFirebaseCredentials(totpPhone);
            let signedIn = false;
            try {
                await signInWithEmailAndPassword(auth, internalEmail, internalPassword);
                signedIn = true;
            } catch (signInError: any) {
                const isNotFound = [
                    'auth/user-not-found', 'auth/invalid-credential',
                    'auth/invalid-login-credentials', 'auth/wrong-password',
                ].includes(signInError.code) || signInError.message?.includes('400');
                if (isNotFound) {
                    try {
                        await createUserWithEmailAndPassword(auth, internalEmail, internalPassword);
                        signedIn = true;
                    } catch (createError: any) {
                        if (createError.code === 'auth/email-already-in-use') {
                            await signInWithEmailAndPassword(auth, internalEmail, internalPassword);
                            signedIn = true;
                        } else if (createError.code === 'auth/operation-not-allowed') {
                            throw new Error('Email/Password sign-in is not enabled in Firebase Console → Authentication → Sign-in methods.');
                        } else { throw createError; }
                    }
                } else { throw signInError; }
            }
            if (signedIn) toast.success('Verified! Redirecting...');
        } catch (error: any) {
            setErrorMsg(error.message?.replace('Firebase: ', '') || 'Sign-in failed. Try again.');
        } finally { setAuthLoading(false); }
    };

    // ── Firebase Phone Auth (SMS) — Hidden/disabled (requires Blaze billing) ──
    // Code kept below for future activation when billing is enabled.
    const setupRecaptcha = (): RecaptchaVerifier => {
        if (recaptchaVerifierRef.current) recaptchaVerifierRef.current.clear();
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => { },
            'expired-callback': () => { setErrorMsg("reCAPTCHA expired. Please try again."); recaptchaVerifierRef.current = null; },
        });
        recaptchaVerifierRef.current = verifier;
        return verifier;
    };
    const handleSendSms = async () => {
        const clean = smsPhone.replace(/[\s\-()]/g, '');
        if (!clean || clean.length < 10 || !clean.startsWith('+')) { setErrorMsg("Enter a valid number with country code."); return; }
        setErrorMsg(""); setAuthLoading(true);
        try {
            const verifier = setupRecaptcha();
            const result = await signInWithPhoneNumber(auth, smsPhone, verifier);
            setConfirmationResult(result); setSmsSent(true); toast.success("OTP sent to " + smsPhone);
        } catch (error: any) {
            recaptchaVerifierRef.current?.clear(); recaptchaVerifierRef.current = null;
            if (error.code === 'auth/billing-not-enabled') setErrorMsg("Firebase SMS requires Blaze billing. Use the free Authenticator tab instead.");
            else if (error.code === 'auth/operation-not-allowed') setErrorMsg("Phone sign-in not enabled in Firebase Console.");
            else if (error.code === 'auth/invalid-phone-number') setErrorMsg("Invalid phone format. Use +919876543210");
            else if (error.code === 'auth/too-many-requests') setErrorMsg("Too many attempts. Wait a few minutes.");
            else setErrorMsg(error.message?.replace("Firebase: ", "") || "Failed to send OTP.");
        } finally { setAuthLoading(false); }
    };
    const handleVerifySms = async () => {
        if (!smsCode || smsCode.length !== 6 || !confirmationResult) { setErrorMsg("Enter the 6-digit SMS code."); return; }
        setErrorMsg(""); setAuthLoading(true);
        try {
            await confirmationResult.confirm(smsCode); toast.success("Verified! Redirecting...");
        } catch (error: any) {
            if (error.code === 'auth/invalid-verification-code') setErrorMsg("Incorrect OTP code.");
            else if (error.code === 'auth/code-expired') { setErrorMsg("OTP expired. Request a new one."); setSmsSent(false); }
            else setErrorMsg(error.message?.replace("Firebase: ", "") || "Verification failed.");
        } finally { setAuthLoading(false); }
    };

    const copyKey = () => {
        navigator.clipboard.writeText(manualKey);
        setKeyCopied(true);
        toast.success("Key copied!");
        setTimeout(() => setKeyCopied(false), 2500);
    };

    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        setErrorMsg("");
        try { await signInWithGoogle(); }
        catch (error: any) { setErrorMsg(error.message?.replace("Firebase: ", "") || "Google sign-in failed."); }
        finally { setAuthLoading(false); }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 text-[#881337]">
            {/* reCAPTCHA container — hidden, required by Firebase Phone Auth */}
            <div id="recaptcha-container" className="hidden" />

            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none" />

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 relative">
                {/* Header */}
                <div className="bg-[#881337] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Heart className="w-24 h-24" /></div>
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-3xl shadow-[0_0_30px_rgba(212,175,55,0.5)] mx-auto mb-4 border-2 border-[#D4AF37] ring-4 ring-white/20">53</div>
                    <h1 className="text-4xl font-extrabold font-serif text-white mb-1 tracking-tight drop-shadow-md">DBohra<span className="text-[#D4AF37] font-medium italic">Rishta</span></h1>
                    <p className="text-white/80 font-bold tracking-[0.25em] uppercase text-[10px] mt-2 border-t border-white/20 pt-2 inline-block">Intentional Matches</p>
                </div>

                <div className="p-6 sm:p-8">
                    <h2 className="text-xl font-bold font-serif mb-4 text-center">Verify Your Identity</h2>

                    {/* Trust badges */}
                    <div className="space-y-1.5 mb-5">
                        <div className="flex items-start text-xs">
                            <ShieldCheck className="w-4 h-4 text-[#881337] mr-2 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Exclusive Dawoodi Bohra community matchmaking with ITS Verification.</p>
                        </div>
                        <div className="flex items-start text-xs">
                            <ShieldCheck className="w-4 h-4 text-[#D4AF37] mr-2 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Dynamic photo blurring protects your privacy until you connect.</p>
                        </div>
                    </div>

                    {/* Google Sign-In */}
                    <button type="button" onClick={handleGoogleLogin} disabled={authLoading}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold shadow-sm hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-3 mb-4 disabled:opacity-50">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Continue with Google
                    </button>

                    {/* OR divider */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-sm text-gray-400 font-medium">OR</span>
                        <div className="h-px bg-gray-200 flex-1" />
                    </div>

                    {/* ── Modern Tabs (Email & Authenticator) ────────────────── */}
                    <div className="flex bg-gray-100/80 p-1.5 rounded-2xl mb-6 shadow-inner ring-1 ring-black/5">
                        <button onClick={() => switchTab("email")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${authMode === "email" ? "bg-white text-[#881337] shadow-md border border-gray-100 scale-[1.02]" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"}`}>
                            <Mail className={`w-4 h-4 ${authMode === "email" ? "text-[#881337]" : "text-gray-400"}`} />
                            <span className="text-xs font-bold uppercase tracking-wide">Email</span>
                        </button>
                        <button onClick={() => switchTab("totp")}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all duration-300 ${authMode === "totp" ? "bg-white text-[#881337] shadow-md border border-gray-100 scale-[1.02]" : "text-gray-500 hover:text-gray-700 hover:bg-white/50"}`}>
                            <Smartphone className={`w-4 h-4 ${authMode === "totp" ? "text-[#881337]" : "text-gray-400"}`} />
                            <span className="text-xs font-bold uppercase tracking-wide">Free OTP</span>
                        </button>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-4">{errorMsg}</div>
                    )}

                    {/* ══════════════ EMAIL TAB ══════════════ */}
                    {authMode === "email" && (
                        <>
                            <form onSubmit={handleEmailAuth} className="space-y-4 mb-5">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input type="email" placeholder="Email Address" value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                {!isResettingPassword && (
                                    <>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                            <input type="password" placeholder="Password" value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                        </div>
                                        {!isRegistering && (
                                            <div className="text-right">
                                                <button type="button" onClick={() => setIsResettingPassword(true)} className="text-xs text-[#D4AF37] font-bold hover:underline">Forgot Password?</button>
                                            </div>
                                        )}
                                    </>
                                )}
                                <button type="submit" disabled={authLoading}
                                    className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                    {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isResettingPassword ? "Send Reset Link" : isRegistering ? "Sign Up" : "Log In with Email"}
                                </button>
                            </form>
                            <div className="text-center text-sm text-gray-500 mb-5">
                                {isResettingPassword ? (
                                    <button type="button" onClick={() => setIsResettingPassword(false)} className="text-[#881337] font-bold underline">Back to Login</button>
                                ) : (
                                    <span>
                                        {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                                        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-[#881337] font-bold underline">
                                            {isRegistering ? "Log In" : "Sign Up"}
                                        </button>
                                    </span>
                                )}
                            </div>
                        </>
                    )}

                    {/* ══════════════ AUTHENTICATOR TOTP TAB ══════════════ */}
                    {authMode === "totp" && (
                        <div className="space-y-4 mb-5">
                            {!qrShown ? (
                                /* ── Step 1: Enter phone number ── */
                                <>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                                        <p className="font-bold mb-1">📱 Mobile Login (Verification)</p>
                                        <p>Enter your mobile number to get a setup code for your authenticator app. Works on any device, no internet needed after setup.</p>
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input type="tel" inputMode="tel" placeholder="e.g. 9876543210"
                                            value={totpPhone} onChange={(e) => setTotpPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                    </div>
                                    <button onClick={handleGenerateQr}
                                        className="w-full bg-[#D4AF37] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#c29e2f] active:scale-95 flex items-center justify-center gap-2">
                                        <Smartphone className="w-4 h-4" /> Generate My Setup Code
                                    </button>
                                </>
                            ) : (
                                /* ── Step 2: Browser-friendly setup UI ── */
                                <>
                                    {/* Context-aware header */}
                                    <div className={`rounded-xl p-3 text-xs border ${isMobileDevice ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                        {isMobileDevice ? (
                                            <p><strong>📱 You're on mobile!</strong> Tap the button below to open directly in your authenticator app — no QR scanning needed.</p>
                                        ) : (
                                            <p><strong>🖥️ You're on desktop.</strong> Open your authenticator app on your phone and scan the QR code, or manually enter the key shown below.</p>
                                        )}
                                    </div>

                                    {/* Mobile: Deep-link button (tap to open authenticator directly) */}
                                    {isMobileDevice && (
                                        <a
                                            href={qrUrl}
                                            className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-emerald-700 active:scale-95 flex items-center justify-center gap-2 no-underline"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Open in Google Authenticator / FreeOTP
                                        </a>
                                    )}

                                    {/* Desktop: QR code */}
                                    {!isMobileDevice && (
                                        <div className="flex justify-center">
                                            <div className="p-3 bg-white rounded-2xl border-4 border-[#D4AF37] shadow-lg inline-block">
                                                <QRCodeSVG value={qrUrl} size={160} bgColor="#FFFFFF" fgColor="#881337" level="M" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Steps — adapted per device */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-700 space-y-1.5">
                                        <p className="font-bold text-[#881337] mb-2">
                                            {isMobileDevice ? "How to set up (mobile):" : "How to set up (desktop):"}
                                        </p>
                                        {isMobileDevice ? (<>
                                            <p>① Install <strong>Google Authenticator</strong> or <strong>FreeOTP</strong> on this phone</p>
                                            <p>② Tap <strong>"Open in Google Authenticator"</strong> above</p>
                                            <p>③ The app adds <strong>DBohraRishta</strong> automatically</p>
                                            <p>④ Enter the 6-digit code shown in the app below</p>
                                        </>) : (<>
                                            <p>① Install <strong>Google Authenticator</strong> or <strong>FreeOTP</strong> on your phone</p>
                                            <p>② Open the app → tap <strong>"+"</strong> → <strong>"Scan QR code"</strong></p>
                                            <p>③ Point your phone camera at the QR above</p>
                                            <p>④ Enter the 6-digit code from the app below</p>
                                        </>)}
                                        <p className="text-gray-400 pt-1">💡 After setup, skip this screen — just enter the 6-digit code directly next time.</p>
                                    </div>

                                    {/* Manual key — always visible, prominent copy */}
                                    <div className="bg-rose-50 border border-[#881337]/20 rounded-xl p-3">
                                        <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
                                            🔑 Can't scan / open app? Enter this key manually in the app:
                                        </p>
                                        <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200">
                                            <code className="text-sm font-mono text-[#881337] break-all tracking-widest flex-1 select-all">{manualKey}</code>
                                            <button
                                                onClick={copyKey}
                                                className="shrink-0 bg-[#D4AF37] text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:bg-[#c29e2f] transition-colors"
                                            >
                                                {keyCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                {keyCopied ? "Copied!" : "Copy"}
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1.5">In the app, tap "+" → "Enter a setup key" → paste the key above. Set account name: <em>DBohraRishta</em></p>
                                    </div>

                                    {/* Code entry */}
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="Enter 6-digit code from app"
                                            value={totpCode}
                                            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-[0.5em] font-mono text-xl"
                                            autoFocus
                                        />
                                    </div>
                                    <button onClick={handleVerifyTotp} disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                        {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Verify &amp; Login
                                    </button>
                                    <button
                                        onClick={() => { setQrShown(false); setTotpCode(""); setErrorMsg(""); }}
                                        className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors"
                                    >
                                        ← Change Mobile Number
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* ══════════════ MOBILE OTP TAB (HIDDEN — requires Firebase Blaze billing) ══════════════
                    {authMode === "phone" && (
                        <div className="space-y-4 mb-5">
                            ... Firebase Phone Auth UI ...
                            ... Re-enable when Blaze billing is activated ...
                            ... handleSendSms / handleVerifySms functions above are ready to use ...
                        </div>
                    )}
                    */}


                    {/* Dev-only test buttons */}
                    {process.env.NODE_ENV === 'development' && (
                        <>
                            <button onClick={async () => { await setDoc(doc(db, "users", "dummy_male"), { name: "Murtaza Test", gender: "male", itsNumber: "12345678", isItsVerified: true, isPremium: true, status: "verified", isCandidateFormComplete: true, jamaat: "Test Jamaat Male", dob: "1995-01-01", hizratLocation: "Mumbai, India", education: "B.Tech CS", libasImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop" }); setDummyUser("dummy_male", "dummy_male@test.com"); router.push("/"); }}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mb-2 text-sm">Dev: Login as Dummy Male</button>
                            <button onClick={async () => { await setDoc(doc(db, "users", "dummy_female"), { name: "Zahra Test", gender: "female", itsNumber: "87654321", isItsVerified: true, isPremium: true, status: "verified", isCandidateFormComplete: true, jamaat: "Test Jamaat Female", dob: "1996-01-01", hizratLocation: "Dubai, UAE", education: "B.Sc Interior Design", libasImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop" }); setDummyUser("dummy_female", "dummy_female@test.com"); router.push("/"); }}
                                className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold text-sm">Dev: Login as Dummy Female</button>
                        </>
                    )}

                    <p className="text-xs text-center text-gray-400 mt-4">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
                </div>
            </div>
        </div>
    );
}
