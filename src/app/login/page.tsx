"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Sparkles, Users, Star, Lock, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { collection, query, where, limit, getDocs, getCountFromServer } from "firebase/firestore";
import DiscoveryCard from "@/components/DiscoveryCard";
import { db } from "@/lib/firebase/config";

export default function LoginPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const router = useRouter();

    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isNewUser, setIsNewUser] = useState(true); // toggle: new vs returning
    const [demoProfiles, setDemoProfiles] = useState<any[]>([]);
    const [liveVerifiedCount, setLiveVerifiedCount] = useState<number | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) router.push("/");
    }, [user, loading, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Female profiles (priority)
                const femaleQ = query(collection(db, 'users'), where('gender', '==', 'female'), where('isItsVerified', '==', true), limit(20));
                const femaleSnap = await getDocs(femaleQ);
                let females = femaleSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

                // Male profiles (shuffled)
                const maleQ = query(collection(db, 'users'), where('gender', '==', 'male'), where('isItsVerified', '==', true), limit(20));
                const maleSnap = await getDocs(maleQ);
                let males = maleSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).sort(() => 0.5 - Math.random());

                // Interleave: female, male, female, male…
                let combined: any[] = [];
                const max = Math.max(females.length, males.length);
                for (let i = 0; i < max; i++) {
                    if (females[i]) combined.push(females[i]);
                    if (males[i]) combined.push({ ...males[i], name: males[i].name?.split(' ')[0] + ' ●●●●' });
                }

                setDemoProfiles(combined);
                localStorage.setItem('cached_demo_profiles', JSON.stringify(combined));

                // Live counts
                const totalQ = query(collection(db, 'users'), where('isItsVerified', '==', true));
                const totalSnap = await getCountFromServer(totalQ);
                setLiveVerifiedCount(totalSnap.data().count);
                localStorage.setItem('cached_live_count', totalSnap.data().count.toString());

            } catch (e) {
                console.error("login3 data fetch error", e);
                
                const cachedCount = localStorage.getItem('cached_live_count');
                if (cachedCount) {
                    setLiveVerifiedCount(parseInt(cachedCount));
                } else {
                    setLiveVerifiedCount(150); // Hardcoded fallback if no cache yet
                }

                const cachedProfiles = localStorage.getItem('cached_demo_profiles');
                if (cachedProfiles) {
                    setDemoProfiles(JSON.parse(cachedProfiles));
                }
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-amber-50 flex flex-col items-center justify-center p-4 text-[#881337]">
            <style>{`
                @keyframes scrollUp {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); }
                }
                .blur-male-img img, .blur-male-img video { filter: blur(4px) !important; }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .fade-up { animation: fadeUp 0.5s ease forwards; }
                .fade-up-1 { animation-delay: 0.1s; opacity: 0; }
                .fade-up-2 { animation-delay: 0.2s; opacity: 0; }
                .fade-up-3 { animation-delay: 0.3s; opacity: 0; }
                .fade-up-4 { animation-delay: 0.4s; opacity: 0; }
                .fade-up-5 { animation-delay: 0.5s; opacity: 0; }
            `}</style>

            <div id="recaptcha-container" className="hidden" />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-[0.03] pointer-events-none" />

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 relative">

                {/* ── HEADER ── */}
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

                {/* ── OUTCOME-FIRST HERO ── */}
                <div className="bg-white px-6 pt-6 pb-5 fade-up fade-up-2 text-center">
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Join the <span className="bg-[#D4AF37] text-white px-2 py-0.5 rounded-md font-black">most trusted platform</span> of 100% ITS-verified <span className="bg-[#D4AF37] text-white px-1.5 rounded font-black whitespace-nowrap">Dawoodi Bohra</span> candidates — where privacy matters most.
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

                {/* ── AUTH ZONE ── */}
                <div className="bg-gray-50/90 border-t border-b border-gray-100 px-6 py-7 fade-up fade-up-4">

                    {/* Toggle: New / Returning */}
                    <div className="flex rounded-xl border border-rose-100 overflow-hidden mb-5 shadow-sm">
                        <button
                            onClick={() => setIsNewUser(true)}
                            className={`flex-1 py-2.5 text-[13px] font-black transition-all ${isNewUser ? 'bg-[#881337] text-white shadow' : 'bg-white text-gray-500 hover:bg-rose-50'}`}
                        >
                            ✨ Join
                        </button>
                        <button
                            onClick={() => setIsNewUser(false)}
                            className={`flex-1 py-2.5 text-[13px] font-black transition-all ${!isNewUser ? 'bg-[#881337] text-white shadow' : 'bg-white text-gray-500 hover:bg-rose-50'}`}
                        >
                            🔑 Login
                        </button>
                    </div>

                    {/* Contextual hint */}
                    {isNewUser ? (
                        <div className="bg-white border border-rose-100 rounded-xl px-4 py-3 mb-5 text-center shadow-sm">
                            <p className="text-[11.5px] text-gray-600 leading-relaxed">
                                Register in <strong className="text-[#881337]">under 60 seconds</strong> with Google — free, private, and exclusively for ITS-verified Dawoodi Bohra candidates.
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white border border-rose-100 rounded-xl px-4 py-3 mb-5 text-center shadow-sm">
                            <p className="text-[11.5px] text-gray-600 leading-relaxed">
                                Please use your <strong className="text-[#881337] underline">same registered Google account</strong> to access your profile and messages.
                            </p>
                        </div>
                    )}

                    {errorMsg && (
                        <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-4">{errorMsg}</div>
                    )}

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        disabled={authLoading}
                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-black shadow-[0_8px_24px_rgba(136,19,55,0.28)] hover:bg-[#70102d] active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 transition-all text-[15px]"
                    >
                        <div className="bg-white p-1 rounded-full w-7 h-7 flex items-center justify-center shrink-0">
                            <GoogleIcon />
                        </div>
                        {isNewUser ? 'Join with Google — It\'s Private' : 'Login with Google'}
                    </button>

                    <p className="text-[10px] text-gray-400 text-center mt-3 font-bold uppercase tracking-wider">
                        Dawoodi Bohra Community Only
                    </p>
                </div>

                {/* ── 3-COLUMN TRUST STRIP ── */}
                <div className="bg-white px-6 pb-5 fade-up fade-up-3">
                    <div className="bg-gradient-to-r from-rose-50 via-white to-amber-50 border border-rose-100 rounded-2xl p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#881337] via-[#D4AF37] to-[#881337]"></div>
                        <p className="text-[10px] font-black text-[#881337] uppercase tracking-widest mb-3 text-center">Built for Dignity. Respected by Families.</p>
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

                {/* ── LIVE PROFILE SCROLLER ── */}
                <div id="scroller-section" className="bg-white px-6 py-6 fade-up fade-up-5">
                    <div className="text-center mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] mb-1">The Most Trusted Platform</p>
                        <h3 className="text-[15px] font-black text-[#881337] mb-1">Live Glimpse of the Platform</h3>
                        <p className="text-[11.5px] text-gray-500 leading-relaxed">
                            These are <strong className="text-[#D4AF37]">real, verified registered members</strong>.
                        </p>
                    </div>

                    {/* Live member stats */}
                    <div className="flex justify-center gap-8 mb-5">
                        <div className="text-center">
                            <p className="text-[24px] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#881337] to-[#D4AF37]">{liveVerifiedCount ? `${liveVerifiedCount}+` : '...'}</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Verified Members</p>
                        </div>
                        <div className="w-px bg-gray-100"></div>
                        <div className="text-center">
                            <p className="text-[24px] font-black text-transparent bg-clip-text bg-gradient-to-r from-[#881337] to-[#D4AF37]">100%</p>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">ITS Verified</p>
                        </div>
                    </div>

                    {/* Scroller */}
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg text-[10px] uppercase tracking-widest text-[#881337] mb-3 font-extrabold w-full justify-center">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#881337] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#881337]"></span>
                        </span>
                        How Profile & Photo Privacy Works
                    </div>
                    <div className="w-full max-w-[320px] mx-auto h-[400px] rounded-xl border-2 border-rose-100 shadow-[0_4px_12px_rgba(140,28,58,0.08)] bg-white overflow-hidden relative">
                        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none"></div>
                        <div className="flex flex-col gap-6 p-4 animate-[scrollUp_30s_linear_infinite] select-none pointer-events-none blur-[2px] opacity-90">
                            {[...demoProfiles, ...demoProfiles].map((profile, i) => (
                                <div key={i} className={`transform scale-[0.85] origin-top w-[117%] -ml-[8.5%] ${profile?.gender === 'male' ? 'blur-male-img' : ''} relative`}>
                                    {profile ? <DiscoveryCard {...profile} isMyProfileVerified={true} /> : null}
                                    {/* Login-to-interact overlay on the Send Interest button area */}
                                    <div className="absolute bottom-0 left-0 right-0 h-[72px] z-50 flex items-end px-4 pb-4">
                                        <div className="w-full py-3 rounded-xl bg-gradient-to-r from-[#881337] to-[#9F1239] text-white text-[13px] font-black text-center shadow-md flex items-center justify-center gap-2">
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

                {/* ── COMMUNITY QUOTE ── */}
                <div className="bg-white px-6 pb-6 fade-up fade-up-3">
                    <div className="relative bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl px-5 py-4">
                        <div className="absolute -top-3 left-5 text-4xl text-[#D4AF37] font-serif leading-none">"</div>
                        <p className="text-[12.5px] text-gray-700 italic leading-relaxed pt-3">
                            We registered our daughter and within 2 weeks received 3 ITS-verified proposals from respectable families. The privacy controls gave us complete peace of mind.
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-200 to-rose-200 flex items-center justify-center text-sm font-bold text-[#881337]">F</div>
                            <div>
                                <p className="text-[11px] font-black text-[#881337]">Fatema B., Mumbai</p>
                                <div className="flex gap-0.5">
                                    {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-[#D4AF37] text-[#D4AF37]" />)}
                                </div>
                            </div>
                            <div className="ml-auto">
                                <span className="text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">✓ Verified Member</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── CONVICTION BLOCKS ── */}
                <div className="bg-white px-6 pb-6 space-y-3 fade-up fade-up-3">
                    <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-2xl px-5 py-4">
                        <p className="text-[13px] font-extrabold text-[#881337] mb-1">👰 For Brides & Their Families</p>
                        <p className="text-[12px] text-gray-700 leading-relaxed">
                            Your photo is <strong>blurred by default</strong> — no one sees you without your approval. ITS-verified grooms are actively waiting. The right rishta won't wait forever.
                        </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-100 rounded-2xl px-5 py-4">
                        <p className="text-[13px] font-extrabold text-[#881337] mb-1">🤝 For Grooms & Their Families</p>
                        <p className="text-[12px] text-gray-700 leading-relaxed">
                            Qualified brides choose this platform precisely for its dignity. Register now — express your sincere interest to families who have already trusted us.
                        </p>
                    </div>
                </div>


                {/* ── ADMIN LINK ── */}
                <div className="bg-white px-6 py-4 text-center border-t border-gray-100">
                    <button
                        onClick={() => router.push('/admin/login')}
                        className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#881337] transition-colors flex items-center justify-center gap-1.5 mx-auto"
                    >
                        <ShieldCheck className="w-3 h-3" /> Admin Login
                    </button>
                </div>

            </div>
        </div>
    );
}
