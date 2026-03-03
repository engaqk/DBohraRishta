"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Heart, Mail, Lock, Phone, Smartphone, Copy, CheckCircle, Loader2, MessageSquare } from "lucide-react";
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

    type AuthTab = "email" | "totp" | "phone";
    const [authMode, setAuthMode] = useState<AuthTab>("email");

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

    // Firebase Phone Auth (SMS) tab state
    const [smsPhone, setSmsPhone] = useState("+91");
    const [smsCode, setSmsCode] = useState("");
    const [smsSent, setSmsSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);

    // Shared
    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

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

    // Clean up reCAPTCHA when switching tabs
    useEffect(() => {
        if (authMode !== "phone") {
            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;
            setSmsSent(false);
            setSmsCode("");
            setConfirmationResult(null);
        }
    }, [authMode]);

    // ── Shared: clear errors when switching tabs ──────────────────────────────
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
            setErrorMsg("Incorrect code. Make sure your phone clock is synced and try again.");
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

    // ── Firebase Phone Auth (SMS): Setup reCAPTCHA ───────────────────────────
    const setupRecaptcha = (): RecaptchaVerifier => {
        if (recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current.clear();
        }
        const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => { /* reCAPTCHA solved */ },
            'expired-callback': () => {
                setErrorMsg("reCAPTCHA expired. Please try again.");
                recaptchaVerifierRef.current = null;
            },
        });
        recaptchaVerifierRef.current = verifier;
        return verifier;
    };

    // ── Firebase Phone Auth: Send SMS ─────────────────────────────────────────
    const handleSendSms = async () => {
        const clean = smsPhone.replace(/[\s\-()]/g, '');
        if (!clean || clean.length < 10 || !clean.startsWith('+')) {
            setErrorMsg("Enter a valid number with country code, e.g. +919876543210");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        try {
            const verifier = setupRecaptcha();
            const result = await signInWithPhoneNumber(auth, smsPhone, verifier);
            setConfirmationResult(result);
            setSmsSent(true);
            toast.success("OTP sent to " + smsPhone);
        } catch (error: any) {
            recaptchaVerifierRef.current?.clear();
            recaptchaVerifierRef.current = null;
            const msg = error.message?.replace("Firebase: ", "") || "Failed to send OTP.";
            if (error.code === 'auth/operation-not-allowed') {
                setErrorMsg("Phone sign-in is not enabled. Go to Firebase Console → Authentication → Sign-in methods and enable 'Phone'.");
            } else if (error.code === 'auth/invalid-phone-number') {
                setErrorMsg("Invalid phone number format. Use international format, e.g. +919876543210");
            } else if (error.code === 'auth/too-many-requests') {
                setErrorMsg("Too many attempts. Please wait a few minutes and try again.");
            } else {
                setErrorMsg(msg);
            }
        } finally { setAuthLoading(false); }
    };

    // ── Firebase Phone Auth: Verify SMS code ──────────────────────────────────
    const handleVerifySms = async () => {
        if (!smsCode || smsCode.length !== 6) {
            setErrorMsg("Enter the 6-digit code from your SMS.");
            return;
        }
        if (!confirmationResult) {
            setErrorMsg("Session expired. Please request a new OTP.");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        try {
            await confirmationResult.confirm(smsCode);
            toast.success("Verified! Redirecting...");
        } catch (error: any) {
            if (error.code === 'auth/invalid-verification-code') {
                setErrorMsg("Incorrect OTP. Please check the code and try again.");
            } else if (error.code === 'auth/code-expired') {
                setErrorMsg("OTP has expired. Please request a new one.");
                setSmsSent(false);
            } else {
                setErrorMsg(error.message?.replace("Firebase: ", "") || "Verification failed.");
            }
        } finally { setAuthLoading(false); }
    };

    const copyKey = () => {
        navigator.clipboard.writeText(manualKey);
        setKeyCopied(true);
        setTimeout(() => setKeyCopied(false), 2000);
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
            {/* Invisible reCAPTCHA container — required by Firebase Phone Auth */}
            <div id="recaptcha-container" ref={recaptchaContainerRef} />

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

                    {/* ── 3 Method Tabs ────────────────────────────────────────── */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-5 gap-1">
                        <button onClick={() => switchTab("email")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${authMode === "email" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>
                            <Mail className="w-3.5 h-3.5" /> Email
                        </button>
                        <button onClick={() => switchTab("totp")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${authMode === "totp" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>
                            <Smartphone className="w-3.5 h-3.5" /> Authenticator
                        </button>
                        <button onClick={() => switchTab("phone")}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${authMode === "phone" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>
                            <MessageSquare className="w-3.5 h-3.5" /> Mobile OTP
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
                                <>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                                        <p className="font-bold mb-1">📱 Free — No SMS charges</p>
                                        <p>Enter your mobile number. You'll get a QR code to scan once with <strong>Google Authenticator</strong> or <strong>FreeOTP</strong>. Then log in using a 6-digit code anytime.</p>
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input type="tel" inputMode="tel" placeholder="+919876543210"
                                            value={totpPhone} onChange={(e) => setTotpPhone(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                    </div>
                                    <button onClick={handleGenerateQr}
                                        className="w-full bg-[#D4AF37] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#c29e2f] active:scale-95 flex items-center justify-center gap-2">
                                        Get Authenticator QR Code
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-gray-700 mb-3">Scan with your authenticator app</p>
                                        <div className="flex justify-center mb-3">
                                            <div className="p-3 bg-white rounded-xl border-4 border-[#D4AF37] shadow-md inline-block">
                                                <QRCodeSVG value={qrUrl} size={160} bgColor="#FFFFFF" fgColor="#881337" level="M" />
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-left text-xs text-gray-700 space-y-1.5 mb-3">
                                            <p className="font-bold text-[#881337] mb-1">How to verify:</p>
                                            <p>① Install <strong>Google Authenticator</strong> or <strong>FreeOTP</strong></p>
                                            <p>② Tap <strong>"+"</strong> → <strong>"Scan QR code"</strong></p>
                                            <p>③ Point at the QR above — app shows <strong>DBohraRishta</strong></p>
                                            <p>④ Enter the shown 6-digit code below</p>
                                            <p className="text-gray-400 pt-1">💡 Next login: skip QR, just enter the code directly.</p>
                                        </div>
                                        <div className="bg-rose-50 border border-[#881337]/20 rounded-xl p-3 mb-3">
                                            <p className="text-xs text-gray-500 mb-1 font-medium">Can't scan? Enter this key manually:</p>
                                            <div className="flex items-center justify-between gap-2">
                                                <code className="text-xs font-mono text-[#881337] break-all tracking-widest">{manualKey}</code>
                                                <button onClick={copyKey} className="shrink-0 text-[#D4AF37] hover:text-[#c29e2f]">
                                                    {keyCopied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input type="text" inputMode="numeric" maxLength={6}
                                            placeholder="6-digit code from app"
                                            value={totpCode}
                                            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-[0.5em] font-mono text-xl" />
                                    </div>
                                    <button onClick={handleVerifyTotp} disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                        {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Verify &amp; Login
                                    </button>
                                    <button onClick={() => { setQrShown(false); setTotpCode(""); setErrorMsg(""); }} className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors mt-1">
                                        ← Change Mobile Number
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* ══════════════ MOBILE OTP (Firebase Phone Auth) TAB ══════════════ */}
                    {authMode === "phone" && (
                        <div className="space-y-4 mb-5">
                            {!smsSent ? (
                                /* Step 1: Enter phone → Send SMS */
                                <>
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 leading-relaxed">
                                        <p className="font-bold mb-1">📲 SMS OTP via Firebase</p>
                                        <p>Enter your mobile number with country code. You'll receive a 6-digit OTP via SMS. Standard carrier rates may apply.</p>
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel"
                                            inputMode="tel"
                                            placeholder="+919876543210"
                                            value={smsPhone}
                                            onChange={(e) => setSmsPhone(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 text-center">
                                        Include country code — e.g. <strong>+91</strong> for India, <strong>+971</strong> for UAE
                                    </p>
                                    <button
                                        onClick={handleSendSms}
                                        disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                        Send OTP via SMS
                                    </button>
                                </>
                            ) : (
                                /* Step 2: Enter SMS OTP → Verify */
                                <>
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                                        <p className="font-bold mb-1">✅ OTP Sent!</p>
                                        <p>A 6-digit OTP has been sent to <strong>{smsPhone}</strong>. Check your SMS and enter it below.</p>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            placeholder="6-digit OTP"
                                            value={smsCode}
                                            onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-[0.5em] font-mono text-xl"
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifySms}
                                        disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                                    >
                                        {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Verify OTP &amp; Login
                                    </button>
                                    <button
                                        onClick={() => { setSmsSent(false); setSmsCode(""); setErrorMsg(""); setConfirmationResult(null); recaptchaVerifierRef.current?.clear(); recaptchaVerifierRef.current = null; }}
                                        className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors mt-1"
                                    >
                                        ← Change Number / Resend OTP
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* OR divider */}
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-sm text-gray-400 font-medium">OR</span>
                        <div className="h-px bg-gray-200 flex-1" />
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
