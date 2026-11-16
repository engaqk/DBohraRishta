"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Sparkles, Smartphone, ChevronLeft, ChevronRight, Lock, Eye, Users, ShieldCheck } from "lucide-react";
import { collection, query, where, limit, getDocs, getCountFromServer } from "firebase/firestore";
import DiscoveryCard from "@/components/DiscoveryCard";
import { db } from "@/lib/firebase/config";

export default function Login2Page() {
    const { user, loading, signInWithGoogle } = useAuth();
    const { t } = useLanguage();
    const router = useRouter();

    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isNewUser, setIsNewUser] = useState(true);
    const [demoProfiles, setDemoProfiles] = useState<any[]>([]);
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
        const fetchData = async () => {
            try {
                const CARD_FIELDS = [
                    'gender', 'name', 'dob', 'jamaat', 'city', 'location', 'hizratLocation',
                    'isItsVerified', 'isBlurSecurityEnabled', 'maritalStatus',
                    'heightFeet', 'heightInch', 'professionType', 'educationDetails',
                    'bio', 'isOnline', 'lastActive', 'createdAt',
                    'libasImageUrl', 'extraImageUrl',
                    'selfieImageUrl', 'selfieStatus',
                    'videoIntroUrl', 'videoStatus',
                    'isPhotoVerified',
                ];

                const stripProfile = (doc: any): any => {
                    const data = doc.data ? doc.data() : doc;
                    const slim: any = { id: doc.id ?? doc.id };
                    CARD_FIELDS.forEach(f => { if (data[f] !== undefined) slim[f] = data[f]; });
                    return slim;
                };

                // Female profiles (priority) — limit 8
                const femaleQ = query(collection(db, 'users'), where('gender', '==', 'female'), where('isItsVerified', '==', true), limit(8));
                const femaleSnap = await getDocs(femaleQ);
                let females = femaleSnap.docs.map(d => stripProfile(d));

                // Male profiles (shuffled) — limit 8
                const maleQ = query(collection(db, 'users'), where('gender', '==', 'male'), where('isItsVerified', '==', true), limit(8));
                const maleSnap = await getDocs(maleQ);
                let males = femaleSnap.docs.length > 0
                    ? maleSnap.docs.map(d => stripProfile(d)).sort(() => 0.5 - Math.random())
                    : maleSnap.docs.map(d => stripProfile(d));

                // Interleave: female, male, female, male…
                let combined: any[] = [];
                const max = Math.max(females.length, males.length);
                for (let i = 0; i < max; i++) {
                    if (females[i]) combined.push(females[i]);
                    if (males[i]) combined.push({ ...males[i], name: (males[i].name?.split(' ')[0] ?? '') + ' ●●●●' });
                }

                setDemoProfiles(combined);
                try {
                    localStorage.setItem('cached_demo_profiles', JSON.stringify(combined));
                } catch (_) {}

                // Live counts
                const totalQ = query(collection(db, 'users'), where('isItsVerified', '==', true));
                const totalSnap = await getCountFromServer(totalQ);
                setLiveVerifiedCount(totalSnap.data().count);
                localStorage.setItem('cached_live_count', totalSnap.data().count.toString());

            } catch (e) {
                console.error("login2 data fetch error", e);
                const cachedCount = localStorage.getItem('cached_live_count');
                if (cachedCount) {
                    setLiveVerifiedCount(parseInt(cachedCount));
                } else {
                    setLiveVerifiedCount(53);
                }

                const cachedProfiles = localStorage.getItem('cached_demo_profiles');
                if (cachedProfiles) {
                    setDemoProfiles(JSON.parse(cachedProfiles));
                }
                setShowHighTrafficBanner(true);
            }
        };
        fetchData();
    }, []);

    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        setErrorMsg("");
        try { await signInWithGoogle(); }
        catch (e: any) { setErrorMsg(e.message?.replace("Firebase: ", "") || "Sign-in failed."); }
        finally { setAuthLoading(false); }
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
        <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-start pt-3 pb-8 px-4 sm:pt-6 sm:pb-12 text-[#881337] selection:bg-[#D4AF37]/30 selection:text-[#881337]">
            <style>{`
                @keyframes scrollUp {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                .blur-male-img img, .blur-male-img video { filter: blur(4px) !important; }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-up { animation: fadeUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .fade-up-1 { animation-delay: 0.05s; opacity: 0; }
                .fade-up-2 { animation-delay: 0.12s; opacity: 0; }
                .fade-up-3 { animation-delay: 0.2s; opacity: 0; }
                .fade-up-4 { animation-delay: 0.28s; opacity: 0; }
            `}</style>

            <div id="recaptcha-container" className="hidden" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-[0.035] pointer-events-none" />

            {/* ── ELEVATED LOGIN CONTAINER CARD ── */}
            <div className="max-w-md w-full bg-white rounded-[2rem] shadow-[0_25px_60px_-15px_rgba(136,19,55,0.18)] overflow-hidden border border-amber-200/50 z-10 relative transition-all">

                {/* ── HEADER (Royal Maroon & Champagne Gold) ── */}
                <div className="bg-gradient-to-b from-[#881337] via-[#800f30] to-[#700b28] p-8 text-center relative overflow-hidden">
                    {/* Absolute Language Switcher */}
                    <div className="absolute top-4 right-4 z-50">
                        <LanguageSwitcher variant="login" />
                    </div>

                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <Sparkles className="w-28 h-28 text-[#D4AF37]" />
                    </div>

                    {/* Circular Gold 53 Emblem */}
                    <div className="w-16 h-16 bg-gradient-to-br from-amber-100 via-white to-amber-200 text-[#D4AF37] rounded-full flex items-center justify-center font-black font-serif text-3xl shadow-[0_0_25px_rgba(212,175,55,0.45)] mx-auto mb-3.5 border-2 border-[#D4AF37] ring-4 ring-white/20">
                        53
                    </div>

                    <h1 className="text-4xl font-extrabold font-serif text-white mb-1 tracking-tight drop-shadow-md">
                        DBohra<span className="text-[#D4AF37] font-serif italic ml-0.5">Rishta</span>
                    </h1>

                    <p className="text-white/85 font-black tracking-[0.22em] uppercase text-[9.5px] mt-1.5 border-t border-white/20 pt-2 inline-block">
                        {t("Intelligent search with extraordinary features")}
                    </p>

                    {/* Live Registered Count Badge */}
                    <div className="mt-3.5 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1 backdrop-blur-md shadow-xs">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4AF37] opacity-80"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4AF37]"></span>
                        </span>
                        <span className="text-[11px] font-black text-white tracking-wide">
                            {liveVerifiedCount ? `${liveVerifiedCount}+ ${t("ITS Card Verified Registered Candidates")}` : 'Loading...'}
                        </span>
                    </div>
                </div>

                {/* ⚠️ High Traffic Banner */}
                {showHighTrafficBanner && (
                    <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-center">
                        <p className="text-[11px] font-bold text-amber-900 leading-relaxed">
                            {t("Salam! We are experiencing exceptionally high traffic today due to a surge in new members! To ensure a smooth experience for everyone, some live updates are temporarily paused. Full live features will automatically resume shortly. Thank you for your patience!")}
                        </p>
                    </div>
                )}

                {/* ── OUTCOME-FIRST HERO ── */}
                <div className="bg-white px-6 pt-5 pb-0 text-center relative z-10 fade-up fade-up-2">
                    <p className="text-[12.5px] text-gray-600 leading-relaxed font-medium">
                        {t("Join the")} <span className="bg-[#D4AF37] text-white px-2 py-0.5 rounded-md font-black shadow-2xs">{t("most trusted platform")}</span> {t("of 100% ITS-verified")} <span className="bg-[#D4AF37] text-white px-1.5 py-0.5 rounded-md font-black whitespace-nowrap shadow-2xs">{t("Dawoodi Bohra")}</span> {t("candidates — where privacy matters most.")}
                    </p>
                    <p className="text-[11px] font-extrabold text-[#881337] mt-3 mb-0 flex items-center justify-center gap-1.5">
                        <span>🛡️</span> {t("Utmost privacy. Complete control. Family trusted.")}
                    </p>
                </div>

                {/* ── LIVE PROFILE SCROLLER ── */}
                <div id="scroller-section" className="bg-white px-6 pt-0 pb-4 fade-up fade-up-3">
                    <div className="text-center mb-3 mt-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] mb-1">The Most Trusted Platform</p>
                        <h3 className="text-[15px] font-black text-[#881337] mb-1">Live Glimpse of the Platform</h3>
                        <p className="text-[11.5px] text-gray-500 leading-relaxed font-medium">
                            These are <strong className="text-[#881337] font-bold">real, verified registered members</strong>.
                        </p>
                    </div>

                    {/* Live member stats */}
                    <div className="flex justify-center gap-8 mb-4">
                        <div className="text-center">
                            <p className="text-[22px] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#881337] to-[#D4AF37]">
                                {liveVerifiedCount ? `${liveVerifiedCount}+` : '...'}
                            </p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Verified Members</p>
                        </div>
                        <div className="w-px bg-gray-200"></div>
                        <div className="text-center">
                            <p className="text-[22px] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#881337] to-[#D4AF37]">
                                100%
                            </p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">ITS Card Verified</p>
                        </div>
                    </div>

                    {/* Scroller Header Strip */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50/80 border border-rose-200/70 rounded-xl text-[10px] uppercase tracking-widest text-[#881337] mb-3 font-extrabold w-full justify-center shadow-2xs">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#881337] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#881337]"></span>
                        </span>
                        How Profile & Photo Privacy Works
                    </div>

                    {/* Animated Scroller Viewport */}
                    <div className="w-full max-w-[320px] mx-auto h-[400px] rounded-2xl border-2 border-rose-100 shadow-[0_6px_20px_rgba(140,28,58,0.08)] bg-white overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white via-white/80 to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent z-10 pointer-events-none"></div>

                        <div className="flex flex-col gap-6 p-4 animate-[scrollUp_30s_linear_infinite] select-none pointer-events-none blur-[2px] opacity-90">
                            {[...demoProfiles, ...demoProfiles].map((profile, i) => (
                                <div key={i} className={`transform scale-[0.85] origin-top w-[117%] -ml-[8.5%] ${profile?.gender === 'male' ? 'blur-male-img' : ''} relative`}>
                                    {profile ? <DiscoveryCard {...profile} isMyProfileVerified={true} /> : null}
                                    {/* Login-to-interact overlay */}
                                    <div className="absolute bottom-0 left-0 right-0 h-[72px] z-50 flex items-end px-4 pb-4">
                                        <div className="w-full py-3 rounded-xl bg-gradient-to-r from-[#881337] to-[#9F1239] text-white text-[13px] font-black text-center shadow-md flex items-center justify-center gap-2 border border-white/20">
                                            <span>🔐 Login to Send Rishta</span>
                                            <span className="text-[#D4AF37]">→</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {demoProfiles.length === 0 && (
                                <div className="flex items-center justify-center h-full text-xs text-gray-400">Loading verified profiles…</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── AUTH ZONE ── */}
                <div className="bg-gray-50/90 border-t border-b border-gray-100 px-6 py-7 fade-up fade-up-4">

                    {/* Toggle: New vs Returning */}
                    <div className="flex rounded-xl border border-rose-200/80 overflow-hidden mb-5 shadow-xs bg-white p-1 gap-1">
                        <button
                            onClick={() => setIsNewUser(true)}
                            className={`flex-1 py-2 rounded-lg text-[13px] font-black transition-all cursor-pointer ${
                                isNewUser ? 'bg-gradient-to-r from-[#881337] to-[#9F1239] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-rose-50/50'
                            }`}
                        >
                            ✨ {t("Join")}
                        </button>
                        <button
                            onClick={() => setIsNewUser(false)}
                            className={`flex-1 py-2 rounded-lg text-[13px] font-black transition-all cursor-pointer ${
                                !isNewUser ? 'bg-gradient-to-r from-[#881337] to-[#9F1239] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-rose-50/50'
                            }`}
                        >
                            🔑 {t("Login")}
                        </button>
                    </div>

                    {/* Contextual hint */}
                    {isNewUser ? (
                        <div className="bg-gradient-to-br from-rose-50/90 via-white to-amber-50/90 border border-rose-200/80 rounded-2xl px-4 py-3.5 mb-5 text-center shadow-2xs">
                            <p className="text-[11px] font-black text-[#881337] uppercase tracking-wider mb-1">
                                ✨ ITS Card Verified Community — Register Now
                            </p>
                            <p className="text-[11px] text-gray-700 leading-relaxed font-medium">
                                {t("Register in under 60 seconds with Google — private, and exclusively for ITS-verified Dawoodi Bohra candidates.")}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-rose-200/70 rounded-2xl px-4 py-3 mb-5 text-center shadow-2xs">
                            <p className="text-[11.5px] text-gray-700 leading-relaxed font-medium">
                                {t("Please use your same registered Google account to access your profile and messages.")}
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 mb-4 text-center">{errorMsg}</div>
                    )}

                    {/* PRIMARY ACTION BUTTON */}
                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={authLoading}
                        className="w-full bg-gradient-to-r from-[#881337] via-[#9F1239] to-[#70102D] text-white py-3.5 rounded-2xl font-black shadow-[0_8px_24px_rgba(136,19,55,0.28)] hover:shadow-[0_12px_28px_rgba(136,19,55,0.36)] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 transition-all text-[15px] border border-rose-300/30 cursor-pointer"
                    >
                        <div className="bg-white p-1 rounded-full w-7 h-7 flex items-center justify-center shrink-0 shadow-xs">
                            <GoogleIcon />
                        </div>
                        <span>{isNewUser ? t("Join with Google — It's Private") : t("Login with Google")}</span>
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-3 font-bold uppercase tracking-wider">
                        {t("Dawoodi Bohra Community Only")}
                    </p>

                    {/* ── MOBILE APP DOWNLOAD SECTION ── */}
                    <div className="mt-5 pt-4 border-t border-gray-200/80">
                        <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[11px] font-black text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Smartphone className="w-3.5 h-3.5 text-[#881337]" />
                                Download Mobile App
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                                Instant Alerts
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            {/* Android App Button */}
                            <a
                                href="/downloads/53DBohraRishta.apk"
                                download="53DBohraRishta.apk"
                                className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white p-2.5 rounded-2xl shadow-sm border border-emerald-600/50 active:scale-95 transition-all group"
                                title="Download Android App directly"
                            >
                                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                    <AndroidIcon className="w-5 h-5 text-emerald-200" />
                                </div>
                                <div className="text-left leading-tight min-w-0">
                                    <p className="text-[8px] uppercase tracking-wider text-emerald-200 font-bold">Download for</p>
                                    <p className="text-[12px] font-black text-white truncate">Android App</p>
                                </div>
                            </a>

                            {/* iOS App Button */}
                            <button
                                onClick={() => router.push('/download')}
                                className="flex items-center gap-2.5 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white p-2.5 rounded-2xl shadow-sm border border-gray-700 active:scale-95 transition-all group cursor-pointer text-left"
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

                {/* ── 3-COLUMN TRUST STRIP ── */}
                <div className="bg-white px-6 pb-5 fade-up fade-up-3">
                    <div className="bg-gradient-to-r from-rose-50 via-white to-amber-50 border border-rose-200/70 rounded-2xl p-4 relative overflow-hidden shadow-2xs">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#881337] via-[#D4AF37] to-[#881337]"></div>
                        <p className="text-[10px] font-black text-[#881337] uppercase tracking-widest mb-3 text-center">
                            Built for Dignity. Respected by Families.
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">🔒</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">Photo hidden by default</p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">👀</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">You approve who views</p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-xl">👨‍👩‍👧</span>
                                <p className="text-[10px] font-bold text-gray-700 leading-tight">Family can co-manage</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── COMMUNITY QUOTE SLIDER ── */}
                <div className="bg-white px-6 pb-6 fade-up fade-up-3">
                    <div className="relative bg-gradient-to-br from-amber-50/80 to-white border border-amber-200/70 rounded-2xl px-5 py-4 shadow-2xs">
                        <div className="absolute -top-3 left-5 text-4xl text-[#D4AF37] font-serif leading-none select-none">"</div>
                        
                        {/* Carousel Navigation Arrows */}
                        <button 
                            type="button"
                            onClick={() => setCurrentSlide(prev => (prev === 0 ? reviews.length - 1 : prev - 1))}
                            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-rose-200 rounded-full flex items-center justify-center shadow-xs hover:bg-rose-50 transition-all z-10 cursor-pointer"
                            title="Previous Review"
                        >
                            <ChevronLeft className="w-3.5 h-3.5 text-[#881337]" />
                        </button>
                        <button 
                            type="button"
                            onClick={() => setCurrentSlide(prev => (prev === reviews.length - 1 ? 0 : prev + 1))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-rose-200 rounded-full flex items-center justify-center shadow-xs hover:bg-rose-50 transition-all z-10 cursor-pointer"
                            title="Next Review"
                        >
                            <ChevronRight className="w-3.5 h-3.5 text-[#881337]" />
                        </button>

                        <div className="px-3 text-center">
                            <p className="text-[11.5px] text-gray-700 italic leading-relaxed font-serif">
                                {reviews[currentSlide].text}
                            </p>
                            <div className="mt-2.5 flex items-center justify-center gap-1.5">
                                <div className="w-4 h-4 rounded-full bg-[#881337] text-white text-[8px] font-black flex items-center justify-center">
                                    {reviews[currentSlide].initial}
                                </div>
                                <span className="text-[10px] font-black text-[#881337]">{reviews[currentSlide].name}</span>
                                <span className="text-gray-300 text-[10px]">•</span>
                                <span className="text-[10px] text-gray-500 font-medium">{reviews[currentSlide].location}</span>
                            </div>
                        </div>

                        {/* Dot Indicators */}
                        <div className="flex justify-center gap-1 mt-2.5">
                            {reviews.map((_, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCurrentSlide(idx)}
                                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                        currentSlide === idx ? 'w-4 bg-[#881337]' : 'w-1.5 bg-gray-300'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
