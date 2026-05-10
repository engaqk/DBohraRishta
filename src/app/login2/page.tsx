"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Sparkles, Mail, Lock, Phone, Smartphone, Copy, CheckCircle, Loader2, MessageSquare, ExternalLink, Users } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, getCountFromServer } from "firebase/firestore";
import DiscoveryCard from "@/components/DiscoveryCard";
import { normalizePhone } from "@/lib/phoneUtils";
import { db } from "@/lib/firebase/config";
import { QRCodeSVG } from "qrcode.react";

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoginPage() {
    const { user, loading, signInWithGoogle, isImpersonating } = useAuth();
    const router = useRouter();

    // OTP state
    const [phone, setPhone] = useState('+91');
    const [otpCode, setOtpCode] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isMobileDevice, setIsMobileDevice] = useState(false);
    const [showMobileLogin, setShowMobileLogin] = useState(false);



    // Shared
    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    // Demo Profiles for animation
    const [demoProfiles, setDemoProfiles] = useState<any[]>([]);
    const [liveVerifiedCount, setLiveVerifiedCount] = useState<number | null>(null);

    useEffect(() => {
        const fetchDemoProfiles = async () => {
            try {
                // Fetch all females (up to 20 for reasonable demo size)
                const femaleQ = query(
                    collection(db, 'users'),
                    where('gender', '==', 'female'),
                    where('isItsVerified', '==', true),
                    limit(20)
                );
                const femaleSnap = await getDocs(femaleQ);
                let females = femaleSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

                // Fetch males and shuffle them randomly
                const maleQ = query(
                    collection(db, 'users'),
                    where('gender', '==', 'male'),
                    where('isItsVerified', '==', true),
                    limit(20)
                );
                const maleSnap = await getDocs(maleQ);
                let males = maleSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                
                // Randomly shuffle males
                males.sort(() => 0.5 - Math.random());

                // Interleave females and males
                let combined = [];
                const maxLen = Math.max(females.length, males.length);
                for (let i = 0; i < maxLen; i++) {
                    if (females[i]) combined.push(females[i]);
                    if (males[i]) combined.push(males[i]);
                }

                // Backup if still empty
                if (combined.length === 0) {
                    const backupQ = query(collection(db, 'users'), limit(10));
                    const backupSnap = await getDocs(backupQ);
                    combined = backupSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
                }

                // Hide male surname in this component only
                combined = combined.map((p: any) => {
                    if (p.gender === 'male' && p.name) {
                        return {
                            ...p,
                            name: p.name.split(' ')[0] + ' ●●●●'
                        };
                    }
                    return p;
                });

                // Fetch live verified count
                try {
                    const verifiedQ = query(
                        collection(db, 'users'),
                        where('isItsVerified', '==', true)
                    );
                    const countSnap = await getCountFromServer(verifiedQ);
                    setLiveVerifiedCount(countSnap.data().count);
                } catch(e) {
                    console.error("Error fetching count", e);
                }

                setDemoProfiles(combined);
            } catch (error) {
                console.error("Error fetching demo profiles:", error);
            }
        };
        fetchDemoProfiles();
    }, []);

    // Detect if running on a mobile/touch device & capture referrals
    useEffect(() => {
        setIsMobileDevice(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
        
        // Capture Referral Code
        const params = new URLSearchParams(window.location.search);
        const refCode = params.get('ref');
        if (refCode) {
            localStorage.setItem('pending_referral_code', refCode);
            console.log("Captured referral code:", refCode);
        }
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
                    <p className="text-white/80 font-bold tracking-[0.25em] uppercase text-[10px] mt-2 border-t border-white/20 pt-2 inline-block">Intelligent search with extraordinary features</p>
                    <div className="mt-4 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 backdrop-blur-sm">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                        </span>
                        <span className="text-[11px] font-black text-white">
                            {liveVerifiedCount ? `${liveVerifiedCount}+ ITS Card Verified Registered Candidates` : 'Loading...'}
                        </span>
                    </div>

                </div>

                <div className="p-6 sm:p-8">
                    {/* Female-first Hero Copy */}
                    <div className="text-center mb-5">
                        <p className="text-[13px] text-gray-600 leading-relaxed">
                            Join the <span className="bg-[#D4AF37] text-white px-2 py-0.5 rounded-md font-black">most trusted platform</span> of 100% ITS-verified <span className="bg-[#D4AF37] text-white px-1.5 py-0.5 rounded-md font-black whitespace-nowrap">Dawoodi Bohra</span> candidates — where privacy matters most.
                        </p>
                        <p className="text-[11px] font-extrabold text-[#881337] mt-3 flex items-center justify-center gap-1">
                            <span>🛡️</span> Utmost privacy. Complete control. Family trusted.
                        </p>
                        <button
                            onClick={() => document.getElementById('scroller-section')?.scrollIntoView({ behavior: 'smooth' })}
                            className="mt-4 inline-flex items-center gap-2 text-[12px] font-extrabold text-[#881337] bg-amber-50 border-2 border-[#D4AF37] px-5 py-2 rounded-full hover:bg-[#D4AF37] hover:text-white transition-all cursor-pointer mx-auto shadow-[0_4px_12px_rgba(212,175,55,0.2)] active:scale-95"
                        >
                            <span>👀 View Live Profiles Glimpse</span>
                            <span className="animate-bounce font-black">↓</span>
                        </button>
                    </div>

                    {/* AUTHENTICATION ZONE */}
                    <div className="bg-gray-50/80 -mx-6 sm:-mx-8 px-6 sm:px-8 py-8 mb-8 border-y border-gray-100">
                        {/* Returning User Note */}
                        <div className="bg-white border border-rose-100 rounded-xl p-3 mb-5 flex items-start gap-2.5 shadow-sm">
                            <svg className="w-5 h-5 text-[#881337] mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            <div>
                                <p className="text-[12px] font-bold text-[#881337] uppercase tracking-wide mb-0.5">Returning User?</p>
                                <p className="text-[11px] leading-relaxed text-[#881337]">
                                    Please use your <strong className="underline">same registered email</strong> to login again correctly and access your profile.
                                </p>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-5">{errorMsg}</div>
                        )}

                        {/* HIGHLIGHTED GOOGLE LOGIN BUTTON */}
                        <button type="button" onClick={handleGoogleLogin} disabled={authLoading}
                            className="w-full bg-[#881337] border-2 border-[#881337] text-white py-3.5 rounded-xl font-bold shadow-[0_8px_20px_rgba(136,19,55,0.25)] hover:bg-[#70102d] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 transition-all text-[15px]">
                            <div className="bg-white p-1 rounded-full flex items-center justify-center w-7 h-7 shrink-0">
                                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                            </div>
                            Login with Google
                        </button>
                    </div>

                    {/* FEMALE-FIRST TRUST STRIP */}
                    <div className="bg-gradient-to-r from-rose-50 via-white to-amber-50 border border-rose-100 rounded-2xl p-4 mb-6 relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#881337] via-[#D4AF37] to-[#881337]"></div>
                        <p className="text-[11px] font-black text-[#881337] uppercase tracking-widest mb-3 text-center">Built for Dignity. Respected by Families.</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">🔒</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">Photo hidden by default</p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">👀</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">You approve who views you</p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">👨‍👩‍👧</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">Family can manage your profile</p>
                            </div>
                        </div>
                    </div>

                    {/* LIVE COMMUNITY STATS */}
                    <div className="mb-6 bg-white border border-rose-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-rose-50 to-transparent rounded-bl-full pointer-events-none opacity-50"></div>
                        <div className="flex justify-center mb-5 mt-2">
                            <div className="flex flex-col items-center bg-white border-2 border-rose-100 px-5 py-3 rounded-2xl shadow-[0_4px_12px_rgba(136,19,55,0.06)] relative overflow-hidden w-full max-w-[320px]">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#881337] via-[#D4AF37] to-[#881337]"></div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="relative flex h-2.5 w-2.5 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#D4AF37]"></span>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#881337] to-[#D4AF37] animate-pulse">{liveVerifiedCount ? `${liveVerifiedCount}+` : '...'}</span>
                                        <svg className="w-4 h-4 text-[#D4AF37] ml-0.5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    </div>
                                </div>
                                <h3 className="text-[12.5px] font-bold text-[#881337] text-center leading-snug">
                                    Registered & ITS-Verified Profiles Awaiting You
                                </h3>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            <span className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#881337]">👩‍⚕️ Doctors</span>
                            <span className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#881337]">👨‍💻 Engineers</span>
                            <span className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#881337]">👩‍🏫 Educators</span>
                            <span className="bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-full text-[11px] font-bold text-[#881337]">💼 Business Owners</span>
                        </div>
                    </div>



                    {/* CONVICTION SECTION — Female-first, Male-inclusive */}
                    <div className="mb-8 space-y-3">
                        <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-2xl px-5 py-4 shadow-sm">
                            <p className="text-[13px] font-extrabold text-[#881337] mb-1">👰 For Brides & Their Families</p>
                            <p className="text-[12px] text-gray-700 leading-relaxed">
                                Your photo is <strong>blurred by default</strong> — no one sees you without your approval. Serious, ITS-verified grooms are actively waiting. The longer you wait, the more you miss out on the right rishta.
                            </p>
                        </div>
                        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl px-5 py-4 shadow-sm">
                            <p className="text-[13px] font-extrabold text-[#881337] mb-1">🤝 For Grooms & Their Families</p>
                            <p className="text-[12px] text-gray-700 leading-relaxed">
                                A growing roster of qualified, verified brides choose this platform for its dignity and discretion. Register now to express your interest before they do.
                            </p>
                        </div>
                        <div className="bg-[#881337] rounded-2xl px-5 py-4 text-white shadow-md">
                            <p className="text-[12px] font-black uppercase tracking-widest mb-1 text-[#D4AF37]">100% Free. 100% Private. 100% Bohra.</p>
                            <p className="text-[12px] leading-relaxed opacity-90">
                                No hidden fees. No strangers. Every profile is ITS-verified. Register in under 60 seconds with Google — your data never leaves this community.
                            </p>
                        </div>
                    </div>


                    {/* NEW: Video Demo Alternative (login2) */}
                    <div id="scroller-section" className="w-full mb-8 text-center">
                        <style>{`
                          @keyframes scrollUp {
                            0% { transform: translateY(0); }
                            100% { transform: translateY(-50%); }
                          }
                          .blur-male-image img, .blur-male-image video {
                            filter: blur(4px) !important;
                          }
                        `}</style>
                        
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] mb-1 text-center">The Most Trusted Platform</p>
                        <h3 className="text-[15px] font-black text-[#881337] mb-1.5">Live Glimpse of the Platform</h3>
                        <p className="text-[12px] text-gray-600 mb-4 px-2 leading-relaxed">
                            These are <strong className="text-[#D4AF37] font-extrabold">real, registered members</strong> currently verified on our platform. Notice how we prioritize your privacy below.
                        </p>

                        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-[11px] uppercase tracking-widest text-[#881337] mb-3 font-extrabold shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#881337] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#881337]"></span>
                            </span>
                            How Profile and Photo Privacy Works
                        </div>
                        <div className="w-full max-w-[320px] mx-auto h-[400px] rounded-xl border-2 border-rose-100 shadow-[0_4px_12px_rgba(140,28,58,0.08)] bg-white overflow-hidden relative flex flex-col">
                            {/* Gradient overlays for smooth fading */}
                            <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none"></div>
                            
                            {/* Scrolling track */}
                            <div className="flex flex-col gap-6 p-4 animate-[scrollUp_30s_linear_infinite] select-none pointer-events-none blur-[2px] opacity-90 transition-all">
                                {/* Repeat the profiles twice to create a seamless loop */}
                                {[...demoProfiles, ...demoProfiles].map((profile, i) => (
                                    <div key={i} className={`transform scale-[0.85] origin-top w-[117%] -ml-[8.5%] ${profile?.gender === 'male' ? 'blur-male-image' : ''} relative`}>
                                        {profile ? <DiscoveryCard {...profile} isMyProfileVerified={true} /> : null}
                                        {/* Login-to-interact overlay on the CTA button area */}
                                        <div className="absolute bottom-0 left-0 right-0 h-[72px] z-50 flex items-end px-4 pb-4">
                                            <div className="w-full py-3 rounded-xl bg-gradient-to-r from-[#881337] to-[#9F1239] text-white text-[13px] font-black text-center shadow-md flex items-center justify-center gap-2">
                                                <span>🔐 Login to Send Rishta</span>
                                                <span className="text-[#D4AF37]">→</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {demoProfiles.length === 0 && (
                                    <div className="flex items-center justify-center h-full text-xs text-gray-400">Loading actual profiles...</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* NEW: Safety Guarantees */}
                    <div className="flex flex-col gap-3 mb-6">
                        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-[20px] bg-rose-50 w-10 h-10 flex items-center justify-center rounded-md shrink-0">🔒</div>
                            <div className="text-[12px] text-gray-800 leading-[1.4]">
                                <strong className="text-[#881337] block text-[13px] mb-0.5">100% Female Profile Privacy</strong>
                                Blurred by default. Only visible upon your request approval.
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="text-[20px] bg-rose-50 w-10 h-10 flex items-center justify-center rounded-md shrink-0">🛡️</div>
                            <div className="text-[12px] text-gray-800 leading-[1.4]">
                                <strong className="text-[#881337] block text-[13px] mb-0.5">100% ITS Verified Profiles</strong>
                                Strict community verification required. No fake profiles.
                            </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                            <div className="bg-rose-50 w-10 h-10 flex items-center justify-center rounded-md shrink-0">
                                <Users className="w-5 h-5 text-[#D4AF37]" />
                            </div>
                            <div className="text-[12px] text-gray-800 leading-[1.4]">
                                <strong className="text-[#881337] block text-[13px] mb-0.5">Guardians can manage the profile</strong>
                                Family-friendly design allows parents to securely control the process.
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 border-t border-gray-100 pt-6 text-center">
                        <button 
                            onClick={() => router.push('/admin/login')}
                            className="text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#881337] transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" /> Are you an Admin? Login here
                        </button>
                    </div>





                </div>
            </div>
        </div>
    );
}
