"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { ShieldCheck, Sparkles, Users, Star, Lock, Eye, EyeOff, Smartphone, Download, CheckCircle2, ChevronLeft, ChevronRight, Shield, Heart } from "lucide-react";
import toast from "react-hot-toast";
import { collection, query, where, limit, getDocs, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function LoginPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isNewUser, setIsNewUser] = useState(true);
    const [liveVerifiedCount, setLiveVerifiedCount] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);
    const [showHighTrafficBanner, setShowHighTrafficBanner] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);

    const reviews = [
        {
            text: "We registered our daughter and within 2 weeks received 3 ITS-verified proposals from respectable families. The privacy controls gave us complete peace of mind.",
            name: "Fatema",
            location: "Indore",
            initial: "F"
        },
        {
            text: "The mandatory ITS verification gave me and my parents the confidence that everyone here is genuine. It makes a huge difference.",
            name: "Alefiya",
            location: "Mumbai",
            initial: "A"
        }
    ];

    useEffect(() => { setMounted(true); }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) router.push("/");
    }, [user, loading, router]);

    useEffect(() => {
        const fetchLiveCount = async () => {
            try {
                const totalQ = query(collection(db, 'users'), where('isItsVerified', '==', true));
                const totalSnap = await getCountFromServer(totalQ);
                setLiveVerifiedCount(totalSnap.data().count);
                localStorage.setItem('cached_live_count', totalSnap.data().count.toString());
            } catch (e) {
                console.error("Login live count fetch error:", e);
                const cachedCount = localStorage.getItem('cached_live_count');
                setLiveVerifiedCount(cachedCount ? parseInt(cachedCount) : 53);
            }
        };
        fetchLiveCount();
    }, []);

    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        setErrorMsg("");
        try {
            await signInWithGoogle();
        } catch (e: any) {
            setErrorMsg(e.message?.replace("Firebase: ", "") || "Sign-in failed.");
        } finally {
            setAuthLoading(false);
        }
    };

    if (!mounted || loading) return null;

    const GoogleIcon = () => (
        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
    );

    const AndroidIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.4116 13.8533 8.082 12 8.082c-1.8533 0-3.5902.3296-5.1368.8677L4.841 5.4467a.4161.4161 0 00-.5677-.1521.4157.4157 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
        </svg>
    );

    const AppleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
        <svg viewBox="0 0 170 170" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.07-7.63-7.83-11.78-14.28-6.1-9.47-10.8-20.15-14.09-32.05-3.29-11.9-4.93-23.05-4.93-33.45 0-14.92 3.73-26.96 11.19-36.12 7.46-9.16 16.89-13.84 28.3-14.05 4.58 0 9.87 1.15 15.86 3.46 5.99 2.31 9.77 3.52 11.34 3.64 1.35-.12 5.16-1.33 11.44-3.64 6.27-2.31 11.45-3.39 15.54-3.24 10.15.53 18.66 4.31 25.53 11.34-8.81 5.34-13.11 12.72-12.9 22.14.21 7.46 2.87 13.79 7.98 19 5.11 5.21 11.28 8.19 18.52 8.94-2.13 6.4-4.8 12.63-8.03 18.69zM119.22 31.84c0-7.36 2.58-14.19 7.74-20.48 5.16-6.29 11.48-10.42 18.96-12.36.21 1.06.32 2.02.32 2.87 0 7.36-2.69 14.23-8.08 20.6-5.38 6.37-11.85 10.29-19.39 11.77-.32-.85-.55-1.65-.55-2.4z" />
        </svg>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFF1F2] via-white to-[#FFFBEB] flex flex-col items-center justify-center p-3 sm:p-6 text-[#881337] font-sans antialiased">
            <div id="recaptcha-container" className="hidden" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-[0.025] pointer-events-none" />

            {/* ── COMPACT INTERNATIONAL-STANDARD CARD ── */}
            <div className="max-w-[420px] w-full bg-white rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(136,19,55,0.15)] border border-rose-100/80 overflow-hidden z-10 relative">

                {/* ── CARD HEADER ── */}
                <div className="bg-gradient-to-br from-[#881337] via-[#9F1239] to-[#70102d] p-6 sm:p-7 text-center relative overflow-hidden text-white">
                    {/* Top Right Language Switcher */}
                    <div className="absolute top-3.5 right-3.5 z-20">
                        <LanguageSwitcher variant="login" />
                    </div>

                    {/* Subtle decorative glow */}
                    <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#D4AF37]/15 rounded-full blur-2xl pointer-events-none" />

                    {/* Golden Bohra 53 Crest */}
                    <div className="w-14 h-14 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-2xl shadow-[0_0_24px_rgba(212,175,55,0.4)] mx-auto mb-3 border-2 border-[#D4AF37] ring-4 ring-white/20">
                        53
                    </div>

                    <h1 className="text-3xl font-extrabold font-serif tracking-tight leading-none drop-shadow-sm">
                        DBohra<span className="text-[#D4AF37] font-normal italic">Rishta</span>
                    </h1>
                    
                    <p className="text-rose-100/90 text-[11px] font-bold tracking-wider uppercase mt-2">
                        Dawoodi Bohra Community Matchmaking
                    </p>

                    {/* Live Verified Members Badge */}
                    <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3.5 py-1 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-black text-white">
                            {liveVerifiedCount ? `${liveVerifiedCount}+ ITS Card Verified Members` : "174+ Verified Members"}
                        </span>
                    </div>
                </div>

                {/* ── AUTHENTICATION ZONE ── */}
                <div className="p-6 sm:p-7 bg-white">
                    {/* Toggle: Join vs Login */}
                    <div className="flex bg-rose-50/70 p-1 rounded-2xl border border-rose-100 mb-4 shadow-inner">
                        <button
                            onClick={() => setIsNewUser(true)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isNewUser
                                    ? "bg-[#881337] text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-900"
                            }`}
                        >
                            ✨ {t("Join")}
                        </button>
                        <button
                            onClick={() => setIsNewUser(false)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                !isNewUser
                                    ? "bg-[#881337] text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-900"
                            }`}
                        >
                            🔑 {t("Login")}
                        </button>
                    </div>

                    {/* Concise Value Line */}
                    <div className="text-center mb-4">
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                            {isNewUser
                                ? t("Private registration in under 60 seconds with your Google account.")
                                : t("Sign in with your registered Google account to view your matches.")}
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 mb-4">
                            {errorMsg}
                        </div>
                    )}

                    {/* Google Sign-in CTA */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={authLoading}
                        className="w-full bg-[#881337] hover:bg-[#70102d] text-white py-3.5 px-4 rounded-2xl font-black shadow-[0_8px_20px_rgba(136,19,55,0.22)] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 transition-all text-sm cursor-pointer"
                    >
                        <div className="bg-white p-1 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                            <GoogleIcon />
                        </div>
                        <span>
                            {authLoading ? "Connecting..." : isNewUser ? t("Join with Google") : t("Sign In with Google")}
                        </span>
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-2.5 font-bold uppercase tracking-wider">
                        Dawoodi Bohra Community Only • Private & Dignified
                    </p>

                    {/* ── DEDICATED MOBILE APP DOWNLOAD SECTION ── */}
                    <div className="mt-6 pt-5 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5 text-[#881337]" />
                                Official Mobile App
                            </span>
                            <span className="text-[10px] font-bold text-gray-400">
                                Android & iOS
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mb-3 leading-tight">
                            Instant push notifications, direct chat, and live match alerts on your smartphone.
                        </p>

                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Android App Button */}
                            <a
                                href="/downloads/53DBohraRishta.apk"
                                download="53DBohraRishta.apk"
                                className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white p-2.5 rounded-2xl shadow-xs border border-emerald-600/40 active:scale-95 transition-all group"
                                title="Download Android App directly"
                            >
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <AndroidIcon className="w-4 h-4 text-emerald-200" />
                                </div>
                                <div className="text-left leading-tight min-w-0">
                                    <p className="text-[8px] uppercase tracking-wider text-emerald-200 font-bold">Download</p>
                                    <p className="text-[12px] font-black text-white truncate">Android App</p>
                                </div>
                            </a>

                            {/* iOS App Button */}
                            <button
                                onClick={() => router.push('/download')}
                                className="flex items-center gap-2.5 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white p-2.5 rounded-2xl shadow-xs border border-gray-700 active:scale-95 transition-all group cursor-pointer text-left"
                                title="Install on iPhone / iPad"
                            >
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <AppleIcon className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-left leading-tight min-w-0">
                                    <p className="text-[8px] uppercase tracking-wider text-gray-300 font-bold">Install on</p>
                                    <p className="text-[12px] font-black text-white truncate">iPhone / iOS</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── 3 CORE VALUES OF DIGNITY ── */}
                <div className="bg-gray-50/80 px-6 py-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#881337] flex items-center justify-center mb-1">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] font-black text-gray-800 leading-tight">ITS Verified</p>
                            <p className="text-[9px] text-gray-500 leading-none mt-0.5">100% Genuine</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-1">
                                <Lock className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] font-black text-gray-800 leading-tight">Photo Privacy</p>
                            <p className="text-[9px] text-gray-500 leading-none mt-0.5">Blurred by Default</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-1">
                                <Heart className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] font-black text-gray-800 leading-tight">Family Trusted</p>
                            <p className="text-[9px] text-gray-500 leading-none mt-0.5">Noble Bohra Adab</p>
                        </div>
                    </div>
                </div>

                {/* ── COMMUNITY TESTIMONIAL ── */}
                <div className="bg-white px-6 py-3.5 border-t border-gray-100">
                    <div className="relative bg-gradient-to-r from-amber-50/70 via-rose-50/30 to-amber-50/70 border border-amber-200/60 rounded-2xl px-4 py-2.5">
                        <p className="text-[11.5px] text-gray-700 italic leading-snug">
                            "{reviews[currentSlide].text}"
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-amber-200/50">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-[#881337]">
                                    {reviews[currentSlide].name}, {reviews[currentSlide].location}
                                </span>
                                <span className="text-[8px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full">
                                    Verified
                                </span>
                            </div>
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Star key={i} className="w-2.5 h-2.5 fill-[#D4AF37] text-[#D4AF37]" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── FOOTER: ADMIN ACCESS ── */}
                <div className="bg-gray-50/60 px-6 py-3 text-center border-t border-gray-100">
                    <button
                        onClick={() => router.push('/admin/login')}
                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#881337] transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                    >
                        <Shield className="w-3 h-3" /> Admin Portal
                    </button>
                </div>
            </div>
        </div>
    );
}
