"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Heart, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, setDummyUser } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);

    useEffect(() => {
        const checkUserStatus = async () => {
            if (!loading && user) {
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        router.push("/");
                    } else {
                        router.push("/onboarding");
                    }
                } catch (e) {
                    console.error("Error checking user doc", e);
                    router.push("/onboarding");
                }
            }
        };
        checkUserStatus();
    }, [user, loading, router]);

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error("Please enter email and password");
            return;
        }
        setAuthLoading(true);
        try {
            if (isRegistering) {
                await signUpWithEmail(email, password);
                toast.success("Account created successfully! Admin approval pending if not dummy.");
            } else {
                await signInWithEmail(email, password);
                toast.success("Looking good! Redirecting...");
            }
        } catch (error: any) {
            toast.error(error.message.replace("Firebase: ", ""));
        } finally {
            setAuthLoading(false);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-6 text-[#881337]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none"></div>

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 relative">
                <div className="bg-[#881337] p-10 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Heart className="w-24 h-24" />
                    </div>
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-3xl shadow-[0_0_30px_rgba(212,175,55,0.5)] mx-auto mb-4 border-2 border-[#D4AF37] ring-4 ring-white/20">
                        53
                    </div>
                    <h1 className="text-4xl font-extrabold font-serif text-white mb-1 tracking-tight drop-shadow-md">
                        DBohra<span className="text-[#D4AF37] font-medium italic">Rishta</span>
                    </h1>
                    <p className="text-white/80 font-bold tracking-[0.25em] uppercase text-[10px] mt-2 mb-2 border-t border-white/20 pt-2 inline-block">
                        Intentional Matches
                    </p>
                </div>

                <div className="p-8">
                    <h2 className="text-xl font-bold font-serif mb-6 text-center">Verify Your Identity</h2>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-start text-sm">
                            <ShieldCheck className="w-5 h-5 text-[#881337] mr-3 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Exclusive community matchmaking with ITS Verification for trust.</p>
                        </div>
                        <div className="flex items-start text-sm">
                            <ShieldCheck className="w-5 h-5 text-[#D4AF37] mr-3 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Dynamic photo blurring protects your privacy until you connect.</p>
                        </div>
                    </div>

                    <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                placeholder={isRegistering ? "Email Address" : "Email (Admin or User)"}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={authLoading}
                            className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {authLoading ? "Please wait..." : (isRegistering ? "Sign Up" : "Log In with Email")}
                        </button>
                    </form>

                    <div className="text-center text-sm text-gray-500 mb-6">
                        {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="text-[#881337] font-bold underline">
                            {isRegistering ? "Log In" : "Sign Up"}
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-px bg-gray-200 flex-1"></div>
                        <span className="text-sm text-gray-400 font-medium">OR</span>
                        <div className="h-px bg-gray-200 flex-1"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-3 mb-4"
                    >
                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                        Continue with Google
                    </button>

                    <button
                        onClick={async () => {
                            await setDoc(doc(db, "users", "dummy_male"), {
                                name: "Murtaza Test",
                                gender: "male",
                                itsNumber: "12345678",
                                isItsVerified: true,
                                isPremium: true,
                                status: "verified",
                                jamaat: "Test Jamaat Male",
                                dob: "1995-01-01",
                                hizratLocation: "Mumbai, India",
                                education: "B.Tech Computer Science",
                                libasImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop"
                            });
                            setDummyUser("dummy_male", "dummy_male@test.com");
                            router.push("/");
                        }}
                        className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-3 mb-3"
                    >
                        Login as Dummy Male (Test)
                    </button>

                    <button
                        onClick={async () => {
                            await setDoc(doc(db, "users", "dummy_female"), {
                                name: "Zahra Test",
                                gender: "female",
                                itsNumber: "87654321",
                                isItsVerified: true,
                                isPremium: true,
                                status: "verified",
                                jamaat: "Test Jamaat Female",
                                dob: "1996-01-01",
                                hizratLocation: "Dubai, UAE",
                                education: "B.Sc Interior Design",
                                libasImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop"
                            });
                            setDummyUser("dummy_female", "dummy_female@test.com");
                            router.push("/");
                        }}
                        className="w-full bg-pink-600 text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-pink-700 active:scale-95 flex items-center justify-center gap-3"
                    >
                        Login as Dummy Female (Test)
                    </button>

                    <p className="text-xs text-center text-gray-400 mt-6">
                        By continuing, you agree to our Terms of Service and Privacy Policy. Mobile verification follows.
                    </p>
                </div>
            </div>
        </div>
    );
}
