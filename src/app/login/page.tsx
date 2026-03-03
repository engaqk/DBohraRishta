"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Heart, Mail, Lock, Phone } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, setDummyUser, setupRecaptcha, sendOtp, verifyOtp } = useAuth();
    const router = useRouter();

    const [authMode, setAuthMode] = useState<"email" | "phone">("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("+91");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);

    const [isRegistering, setIsRegistering] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [isOtpLimitReached, setIsOtpLimitReached] = useState(false);

    // Initialize recaptcha instantly on mount for phone auth container
    useEffect(() => {
        if (authMode === "phone") {
            try {
                setupRecaptcha("recaptcha-container");
            } catch (e) { console.error(e) }
        }
    }, [authMode, setupRecaptcha]);

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

    // Check SMS Limit on Mount to proactively disable Mobile option
    useEffect(() => {
        const checkSmsLimit = async () => {
            try {
                const todayStr = new Date().toISOString().split('T')[0];
                const trackerSnap = await getDoc(doc(db, "sys_otp_usage", todayStr));
                if (trackerSnap.exists() && trackerSnap.data().count >= 10) {
                    setIsOtpLimitReached(true);
                }
            } catch (e) {
                console.error("Failed fetching limits", e);
            }
        };
        checkSmsLimit();
    }, []);

    const handleGoogleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");
        if (!email || !password) {
            setErrorMsg("Please enter email and password");
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
            setErrorMsg(error.message.replace("Firebase: ", ""));
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSendOtp = async () => {
        if (!phone || phone.length < 10) {
            setErrorMsg("Please enter a valid mobile number with country code (e.g. +91...)");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);

        try {
            // Strict Daily Quota Checking Table
            const todayStr = new Date().toISOString().split('T')[0];
            const trackerRef = doc(db, "sys_otp_usage", todayStr);
            const trackerSnap = await getDoc(trackerRef);

            let currentCount = 0;
            if (trackerSnap.exists()) {
                currentCount = trackerSnap.data().count || 0;
            }

            if (currentCount >= 10) {
                setIsOtpLimitReached(true);
                toast.error("Maximum 10 OTP verifications hit for today globally. Redirecting to Email authentication fallback.", { duration: 6000 });
                setAuthMode("email");
                setErrorMsg("");
                setAuthLoading(false);
                return; // Stop execution, don't ping Firebase Auth SMS
            }

            // Fire SMS Request
            await sendOtp(phone);
            setOtpSent(true);
            toast.success("OTP Sent Successfully!");

            // Log Success inside Table
            await setDoc(trackerRef, { count: currentCount + 1 }, { merge: true });

        } catch (error: any) {
            const errStr = error.message || "";
            if (errStr.includes("auth/operation-not-allowed")) {
                setErrorMsg("Developer: Phone Auth is currently disabled in your Firebase console. Please go to Build -> Auth -> Sign-in Method and enable 'Phone' to clear this error.");
            } else {
                setErrorMsg(errStr.replace("Firebase: ", ""));
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            setErrorMsg("Please enter the OTP.");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        try {
            await verifyOtp(otp);
            toast.success("Phone Verified successfully! Redirecting...");
        } catch (error: any) {
            setErrorMsg(error.message.replace("Firebase: ", ""));
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

                    <div className="flex bg-gray-100 p-1 rounded-xl mb-6 relative group">
                        <button onClick={() => setAuthMode("email")} className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === "email" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>Email</button>
                        <button
                            disabled={isOtpLimitReached}
                            onClick={() => setAuthMode("phone")}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${authMode === "phone" ? "bg-white text-[#881337] shadow-sm" : isOtpLimitReached ? "text-gray-400 opacity-60 cursor-not-allowed line-through" : "text-gray-500"}`}
                            title={isOtpLimitReached ? "Daily quota exceeded (10/day). Try again tomorrow." : ""}
                        >
                            Mobile OTP
                        </button>
                        {isOtpLimitReached && (
                            <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg hidden group-hover:block whitespace-nowrap z-50 text-center shadow-lg pointer-events-none">
                                Daily SMS limit filled.<br />Please use Email, or wait 24hrs.
                            </div>
                        )}
                    </div>

                    <div id="recaptcha-container"></div>

                    {errorMsg && <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-4">{errorMsg}</div>}

                    {authMode === "email" ? (
                        <>
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
                        </>
                    ) : (
                        <div className="space-y-4 mb-6">
                            {!otpSent ? (
                                <>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="tel"
                                            placeholder="Mobile Number (e.g. +9198765...)"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSendOtp}
                                        disabled={authLoading}
                                        className="w-full bg-[#D4AF37] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#c29e2f] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {authLoading ? "Sending OTP..." : "Send Verification Code"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Enter 6-digit OTP"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-widest font-mono text-xl"
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerifyOtp}
                                        disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                                    >
                                        {authLoading ? "Verifying..." : "Confirm & Login"}
                                    </button>
                                    <button onClick={() => setOtpSent(false)} className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors mt-2">Change Mobile Number</button>
                                </>
                            )}
                        </div>
                    )}

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
