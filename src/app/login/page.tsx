"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Sparkles, Mail, Lock, Phone, Smartphone, Copy, CheckCircle, Loader2, MessageSquare, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { normalizePhone } from "@/lib/phoneUtils";
import { db } from "@/lib/firebase/config";
import { QRCodeSVG } from "qrcode.react";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

// ─── Live Counter Component ──────────────────────────────────────────────────
function LiveUserCounter() {
    const [count, setCount] = useState(0);
    const [target, setTarget] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const res = await fetch('/api/public-stats');
                const data = await res.json();
                if (data.count) setTarget(data.count);
            } catch (e) {
                setTarget(530); // Fallback
            }
        };
        fetchCount();
        
        // Slightly increase the target count over time to look "continuous"
        const interval = setInterval(() => {
            setTarget(prev => prev + (Math.random() > 0.7 ? 1 : 0));
        }, 30000);
        
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (count < target) {
            const diff = target - count;
            const increment = Math.max(1, Math.floor(diff / 10)); // Faster incrementing initially
            const timer = setTimeout(() => {
                setCount(prev => Math.min(prev + increment, target));
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [count, target]);

    return <span className="font-mono text-emerald-300 ml-1">{count}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoginPage() {
    const { user, loading, signInWithGoogle, setDummyUser, isImpersonating } = useAuth();
    const router = useRouter();

    // OTP state
    const [phone, setPhone] = useState('+91');
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(false);



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
                    const isComplete = userDoc.exists() && userDoc.data()?.isCandidateFormComplete === true;

                    if (isComplete) {
                        router.push("/");
                    } else {
                        // Only send "complete your profile" reminder to email/Google users
                        // Mobile-only users (whose Firebase email ends with @dbohrarishta.local) get NO email
                        const isMobileOnly = user.email?.endsWith('@dbohrarishta.local');
                        const alreadySentWelcome = userDoc.exists() && userDoc.data()?.welcomeEmailSent === true;

                        if (!isMobileOnly && !alreadySentWelcome && user.email) {
                            const { notifyWelcomeOnboarding } = await import('@/lib/emailService');
                            notifyWelcomeOnboarding({
                                candidateName: user.displayName || undefined,
                                candidateEmail: user.email,
                                isReminder: true,   // tells the function to use reminder copy
                            }).catch(err => console.error("Complete profile email failed:", err));
                        }

                        if (!isImpersonating) {
                            router.push("/onboarding");
                        } else {
                            router.push("/");
                        }
                    }
                } catch { router.push("/onboarding"); }
            }
        };
        checkUserStatus();
    }, [user, loading, router]);




    // ── OTP: Step 1 — Send OTP (or direct login for returning users) ─────────
    const handleSendOtp = async () => {
        const raw = phone.trim();
        if (!raw || !raw.startsWith('+')) {
            setErrorMsg("Enter a valid number starting with +, e.g. +919876543210");
            return;
        }

        // Normalize before validation — fixes +9109... → +919... etc.
        const clean = normalizePhone(raw);
        if (!clean) {
            setErrorMsg("Invalid phone number. Use E.164 format e.g. +919876543210");
            return;
        }
        if (clean.length < 10 || clean.length > 16) {
            setErrorMsg("Enter a valid mobile number (10 to 15 digits including country code)");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);

        try {
            // ── Step 1a: Check if this mobile is already registered ──────────
            // If yes, sign in directly without needing OTP again
            const checkRes = await fetch('/api/otp/check-mobile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: clean })
            });
            const checkData = await checkRes.json();

            if (checkData.exists && checkData.internalEmail && checkData.internalPassword) {
                // Returning user — sign in directly, no OTP needed
                try {
                    await signInWithEmailAndPassword(auth, checkData.internalEmail, checkData.internalPassword);
                    const { getDoc, doc } = await import('firebase/firestore');
                    const userDoc = await getDoc(doc(db, 'users', auth.currentUser!.uid));

                    if (userDoc.exists() && userDoc.data().status === 'archived') {
                        const { signOut } = await import('firebase/auth');
                        await signOut(auth);
                        setErrorMsg('Your account has been deactivated. Please contact support.');
                        setAuthLoading(false);
                        return;
                    }

                    // Persist phone for onboarding pre-fill in case they haven't completed it
                    sessionStorage.setItem('verifiedPhone', clean);
                    sessionStorage.setItem('loginMethod', 'mobile');
                    toast.success('Welcome back! Signing you in...');
                    router.push(userDoc.exists() ? "/" : "/onboarding");
                    return;
                } catch {
                    // If direct sign-in fails for any reason, fall through to OTP
                }
            }

            // ── Step 1b: New user or check failed — send OTP ─────────────────
            const response = await fetch('/api/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: clean })
            });

            const data = await response.json();
            if (data.success) {
                setOtpSent(true);
                toast.success("OTP sent to your mobile!");
            } else {
                setErrorMsg(data.error || "Failed to send OTP. Try again.");
            }
        } catch (err: any) {
            setErrorMsg("Connection error. Check your internet.");
        } finally {
            setAuthLoading(false);
        }
    };

    // ── OTP: Step 2 — Verify OTP and sign in ────────────────────────────────
    const handleVerifyOtp = async () => {
        if (!otpCode || otpCode.length !== 6) {
            setErrorMsg("Enter the 6-digit verification code.");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);

        try {
            const clean = phone.trim().toLowerCase();
            const response = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: clean, code: otpCode })
            });

            const data = await response.json();
            if (!data.success) {
                setErrorMsg(data.error || "Incorrect Code. Please try again.");
                setAuthLoading(false);
                return;
            }
            const { internalEmail, internalPassword, verifiedPhone, loginMethod } = data;
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
                            throw new Error('Email/Password sign-in is not enabled in Firebase Console.');
                        } else { throw createError; }
                    }
                } else { throw signInError; }
            }
            if (signedIn && auth.currentUser) {
                const { getDoc, doc } = await import('firebase/firestore');
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));

                if (userDoc.exists() && userDoc.data().status === 'archived') {
                    const { signOut } = await import('firebase/auth');
                    await signOut(auth);
                    setErrorMsg('Your account has been deactivated. Please contact support.');
                    setAuthLoading(false);
                    return;
                }

                // Store verified phone and login method for onboarding to use
                if (verifiedPhone) {
                    sessionStorage.setItem('verifiedPhone', verifiedPhone);
                    sessionStorage.setItem('loginMethod', loginMethod || 'mobile');
                }

                toast.success('Verified! Redirecting...');
                router.push(userDoc.exists() ? "/" : "/onboarding");
            }
        } catch (error: any) {
            setErrorMsg(error.message?.replace('Firebase: ', '') || 'Sign-in failed.');
        } finally { setAuthLoading(false); }
    };



    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        setErrorMsg("");
        try { await signInWithGoogle(); }
        catch (error: any) { setErrorMsg(error.message?.replace("Firebase: ", "") || "Google sign-in failed."); }
        finally { setAuthLoading(false); }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!mounted || loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 text-[#881337]">
            {/* reCAPTCHA container — hidden, required by Firebase Phone Auth */}
            <div id="recaptcha-container" className="hidden" />

            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none" />

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 relative">
                {/* Header */}
                <div className="bg-[#881337] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Sparkles className="w-24 h-24" /></div>
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-3xl shadow-[0_0_30px_rgba(212,175,55,0.5)] mx-auto mb-4 border-2 border-[#D4AF37] ring-4 ring-white/20">53</div>
                    <h1 className="text-4xl font-extrabold font-serif text-white mb-1 tracking-tight drop-shadow-md">DBohra<span className="text-[#D4AF37] font-medium italic">Rishta</span></h1>
                    <p className="text-white/80 font-bold tracking-[0.25em] uppercase text-[10px] mt-2 border-t border-white/20 pt-2 inline-block">Intelligent Matches</p>
                    
                    {/* Live Community Count */}
                    <div className="mt-4 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-1000 delay-300">
                        <div className="bg-white/10 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/20 flex items-center gap-2">
                             <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                             <span className="text-white text-[11px] font-black uppercase tracking-wider">
                                <LiveUserCounter /> Members Registered
                             </span>
                        </div>
                    </div>
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

                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-4">{errorMsg}</div>
                    )}

                    {/* ══════════════ SMS OTP LOGIN ══════════════ */}
                    <div className="space-y-4 mb-5">
                        {!otpSent ? (
                            /* ── Step 1: Enter phone number ── */
                            <>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                                    <p className="font-bold mb-1">📱 SMS Mobile Login</p>
                                    <p>Enter your mobile number to receive a 6-digit verification code via SMS.</p>
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input type="tel" inputMode="tel" placeholder="+919876543210"
                                        maxLength={16}
                                        value={phone}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const sanitized = val.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');
                                            setPhone(sanitized);
                                        }}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <button onClick={handleSendOtp} disabled={authLoading}
                                    className="w-full bg-[#D4AF37] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#c29e2f] active:scale-95 flex items-center justify-center gap-2">
                                    {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                                    Send Verification Code
                                </button>
                            </>
                        ) : (
                            /* ── Step 2: Enter OTP code ── */
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
                                    <p><strong>Code Sent!</strong> Please check your messages on <strong>{phone}</strong> and enter the 6-digit code below.</p>
                                </div>

                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        placeholder="Enter 6-digit OTP"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-[0.5em] font-mono text-xl"
                                        autoFocus
                                    />
                                </div>
                                <button onClick={handleVerifyOtp} disabled={authLoading}
                                    className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2">
                                    {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Verify &amp; Login
                                </button>
                                <button
                                    onClick={() => { setOtpSent(false); setOtpCode(""); setErrorMsg(""); }}
                                    className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors"
                                >
                                    ← Change Mobile Number
                                </button>
                            </>
                        )}
                    </div>


                    {/* Dev-only test buttons */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-gray-100">
                            <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest">Development Only</p>
                            <button onClick={async () => {
                                try {
                                    // Try to pre-create doc, but don't block if it fails (likely due to rules)
                                    setDoc(doc(db, "users", "dummy_male"), {
                                        name: "Murtaza Test", gender: "male", itsNumber: "12345678", isItsVerified: true, isPremium: true, status: "verified", isCandidateFormComplete: true, jamaat: "Test Jamaat Male", dob: "1995-01-01", hizratLocation: "Mumbai, India", education: "B.Tech CS", libasImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop"
                                    }).catch(e => console.warn("Dev setDoc failed:", e));

                                    setDummyUser("dummy_male", "dummy_male@test.com");
                                    toast.success("Logged in as Dummy Male");
                                    router.push("/");
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 active:scale-95 transition-all">Dev: Login as Dummy Male</button>

                            <button onClick={async () => {
                                try {
                                    setDoc(doc(db, "users", "dummy_female"), {
                                        name: "Zahra Test", gender: "female", itsNumber: "87654321", isItsVerified: true, isPremium: true, status: "verified", isCandidateFormComplete: true, jamaat: "Test Jamaat Female", dob: "1996-01-01", hizratLocation: "Dubai, UAE", education: "B.Sc Interior Design", libasImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop"
                                    }).catch(e => console.warn("Dev setDoc failed:", e));

                                    setDummyUser("dummy_female", "dummy_female@test.com");
                                    toast.success("Logged in as Dummy Female");
                                    router.push("/");
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                                className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-pink-700 active:scale-95 transition-all">Dev: Login as Dummy Female</button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
