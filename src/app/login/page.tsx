"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ShieldCheck, Heart, Mail, Lock, Phone, Smartphone, Copy, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, setDummyUser, sendOtp, verifyOtp, resetPassword, totpQr } = useAuth();
    const router = useRouter();

    const [authMode, setAuthMode] = useState<"email" | "phone">("email");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("+91");
    const [totp, setTotp] = useState("");        // 6-digit TOTP code from authenticator app
    const [qrShown, setQrShown] = useState(false); // QR step shown

    const [isRegistering, setIsRegistering] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [authLoading, setAuthLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [keyCopied, setKeyCopied] = useState(false);

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
                    router.push("/onboarding");
                }
            }
        };
        checkUserStatus();
    }, [user, loading, router]);

    const handleGoogleLogin = async () => {
        setAuthLoading(true);
        setErrorMsg("");
        try {
            await signInWithGoogle();
        } catch (error: any) {
            setErrorMsg(error.message?.replace("Firebase: ", "") || "Google sign-in failed. Please try again.");
        } finally {
            setAuthLoading(false);
        }
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (isResettingPassword) {
            if (!email) { setErrorMsg("Please enter your email to reset password"); return; }
            setAuthLoading(true);
            try {
                await resetPassword(email);
                toast.success("Password reset email sent! Check your inbox.");
                setIsResettingPassword(false);
            } catch (error: any) {
                setErrorMsg(error.message.replace("Firebase: ", ""));
            } finally {
                setAuthLoading(false);
            }
            return;
        }

        if (!email || !password) { setErrorMsg("Please enter email and password"); return; }
        if (isRegistering && password.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }

        setAuthLoading(true);
        try {
            if (isRegistering) {
                await signUpWithEmail(email, password);
                toast.success("Account created! Admin verification pending.");
            } else {
                await signInWithEmail(email, password);
                toast.success("Welcome back! Redirecting...");
            }
        } catch (error: any) {
            setErrorMsg(error.message.replace("Firebase: ", ""));
        } finally {
            setAuthLoading(false);
        }
    };

    // Step 1: Generate QR code for the phone number
    const handleGenerateQr = async () => {
        const cleanPhone = phone.replace(/[\s\-()]/g, '');
        if (!cleanPhone || cleanPhone.length < 12 || !cleanPhone.startsWith('+')) {
            setErrorMsg("Please enter a valid mobile number with country code (e.g. +919876543210)");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        try {
            await sendOtp(phone); // generates QR, stored in totpQr context
            setQrShown(true);
        } catch (error: any) {
            setErrorMsg(error.message || "Failed to generate QR code. Try again.");
        } finally {
            setAuthLoading(false);
        }
    };

    // Step 2: Verify the 6-digit TOTP code from authenticator app
    const handleVerifyTotp = async () => {
        if (!totp || totp.length !== 6) {
            setErrorMsg("Please enter the 6-digit code from your authenticator app.");
            return;
        }
        setErrorMsg("");
        setAuthLoading(true);
        try {
            await verifyOtp(totp);
            toast.success("Verified! Redirecting...");
        } catch (error: any) {
            setErrorMsg(error.message?.replace("Firebase: ", "") || "Incorrect code. Please try the latest code from your app.");
        } finally {
            setAuthLoading(false);
        }
    };

    const copyManualKey = () => {
        if (totpQr?.manualKey) {
            navigator.clipboard.writeText(totpQr.manualKey);
            setKeyCopied(true);
            setTimeout(() => setKeyCopied(false), 2000);
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4 text-[#881337]">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/arabesque.png')] opacity-5 pointer-events-none" />

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 z-10 relative">
                {/* Header */}
                <div className="bg-[#881337] p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Heart className="w-24 h-24" /></div>
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-3xl shadow-[0_0_30px_rgba(212,175,55,0.5)] mx-auto mb-4 border-2 border-[#D4AF37] ring-4 ring-white/20">53</div>
                    <h1 className="text-4xl font-extrabold font-serif text-white mb-1 tracking-tight drop-shadow-md">DBohra<span className="text-[#D4AF37] font-medium italic">Rishta</span></h1>
                    <p className="text-white/80 font-bold tracking-[0.25em] uppercase text-[10px] mt-2 mb-2 border-t border-white/20 pt-2 inline-block">Intentional Matches</p>
                </div>

                <div className="p-6 sm:p-8">
                    <h2 className="text-xl font-bold font-serif mb-5 text-center">Verify Your Identity</h2>

                    <div className="space-y-3 mb-6">
                        <div className="flex items-start text-sm">
                            <ShieldCheck className="w-5 h-5 text-[#881337] mr-3 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Exclusive community matchmaking with ITS Verification for trust.</p>
                        </div>
                        <div className="flex items-start text-sm">
                            <ShieldCheck className="w-5 h-5 text-[#D4AF37] mr-3 mt-0.5 shrink-0" />
                            <p className="text-gray-600">Dynamic photo blurring protects your privacy until you connect.</p>
                        </div>
                    </div>

                    {/* Auth Mode Tabs */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                        <button onClick={() => { setAuthMode("email"); setErrorMsg(""); setQrShown(false); }}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${authMode === "email" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>
                            <Mail className="w-4 h-4" /> Email
                        </button>
                        <button onClick={() => { setAuthMode("phone"); setErrorMsg(""); }}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${authMode === "phone" ? "bg-white text-[#881337] shadow-sm" : "text-gray-500"}`}>
                            <Smartphone className="w-4 h-4" /> Authenticator
                        </button>
                    </div>

                    {errorMsg && <div className="p-3 bg-red-50 text-red-500 text-sm font-bold rounded-xl border border-red-100 mb-4">{errorMsg}</div>}

                    {/* EMAIL TAB */}
                    {authMode === "email" ? (
                        <>
                            <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                    <input type="email" placeholder={isRegistering ? "Email Address" : "Email (Admin or Member)"}
                                        value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                {!isResettingPassword && (
                                    <>
                                        <div className="relative">
                                            <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
                                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                        </div>
                                        {!isRegistering && (
                                            <div className="text-right">
                                                <button type="button" onClick={() => setIsResettingPassword(true)} className="text-xs text-[#D4AF37] font-bold hover:underline">
                                                    Forgot Password?
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                                <button type="submit" disabled={authLoading}
                                    className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                                    {authLoading ? "Please wait..." : isResettingPassword ? "Send Reset Link" : isRegistering ? "Sign Up" : "Log In with Email"}
                                </button>
                            </form>
                            <div className="text-center text-sm text-gray-500 mb-6 flex flex-col gap-2">
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
                    ) : (
                        /* AUTHENTICATOR APP TAB */
                        <div className="space-y-4 mb-6">
                            {!qrShown ? (
                                /* Step 1: Enter phone → get QR */
                                <>
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
                                        <p className="font-bold mb-1">📱 One-time setup required</p>
                                        <p>Enter your mobile number below. You'll receive a QR code to scan once with <strong>Google Authenticator</strong> or <strong>FreeOTP</strong>. After that, log in anytime using the 6-digit code — no SMS, completely free.</p>
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input type="tel" inputMode="tel" placeholder="Mobile Number (e.g. +919876543210)"
                                            value={phone} onChange={(e) => setPhone(e.target.value)}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none" />
                                    </div>
                                    <button onClick={handleGenerateQr} disabled={authLoading}
                                        className="w-full bg-[#D4AF37] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#c29e2f] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                                        {authLoading ? "Generating QR Code..." : "Get My Authenticator QR Code"}
                                    </button>
                                </>
                            ) : (
                                /* Step 2: Show QR → enter TOTP code */
                                <>
                                    <div className="text-center">
                                        <p className="text-sm font-bold text-gray-700 mb-3">Scan this QR code with your authenticator app</p>
                                        {totpQr?.qrDataUrl && (
                                            <div className="flex justify-center mb-3">
                                                <img src={totpQr.qrDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-xl border-4 border-[#D4AF37] shadow-md" />
                                            </div>
                                        )}

                                        {/* Step-by-step instructions */}
                                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left text-xs text-gray-700 space-y-2 mb-4">
                                            <p className="font-bold text-[#881337] text-sm mb-2">How to verify:</p>
                                            <p>① Install <strong>Google Authenticator</strong> or <strong>FreeOTP</strong> from your app store.</p>
                                            <p>② Open the app → tap <strong>"+"</strong> → tap <strong>"Scan a QR code"</strong>.</p>
                                            <p>③ Point your camera at the QR code above.</p>
                                            <p>④ The app will show <strong>DBohraRishta</strong> with a 6-digit code refreshing every 30 seconds.</p>
                                            <p>⑤ Enter that 6-digit code below and tap <strong>Verify &amp; Login</strong>.</p>
                                            <p className="text-gray-500 pt-1">💡 Next time you log in, just open your app and enter the code directly — no QR scan needed again.</p>
                                        </div>

                                        {/* Manual key fallback */}
                                        <div className="bg-rose-50 border border-[#881337]/20 rounded-xl p-3 mb-4">
                                            <p className="text-xs text-gray-500 mb-1.5 font-medium">Can't scan? Enter this key manually in the app:</p>
                                            <div className="flex items-center justify-between gap-2">
                                                <code className="text-xs font-mono text-[#881337] break-all">{totpQr?.manualKey}</code>
                                                <button onClick={copyManualKey} className="shrink-0 text-[#D4AF37] hover:text-[#c29e2f])">
                                                    {keyCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6-digit TOTP input */}
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                                        <input type="text" inputMode="numeric" maxLength={6}
                                            placeholder="6-digit code from your app"
                                            value={totp}
                                            onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                                            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none text-center tracking-[0.5em] font-mono text-xl" />
                                    </div>
                                    <button onClick={handleVerifyTotp} disabled={authLoading}
                                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-[#9F1239] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                                        {authLoading ? "Verifying..." : "Verify & Login"}
                                    </button>
                                    <button onClick={() => { setQrShown(false); setTotp(""); setErrorMsg(""); }} className="w-full text-xs text-gray-500 hover:text-gray-800 transition-colors mt-1">
                                        ← Change Mobile Number
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Divider */}
                    <div className="flex items-center gap-4 mb-5">
                        <div className="h-px bg-gray-200 flex-1" />
                        <span className="text-sm text-gray-400 font-medium">OR</span>
                        <div className="h-px bg-gray-200 flex-1" />
                    </div>

                    <button type="button" onClick={handleGoogleLogin} disabled={authLoading}
                        className="w-full bg-white border border-gray-300 text-gray-700 py-3.5 rounded-xl font-bold transition-all shadow-sm hover:bg-gray-50 active:scale-95 flex items-center justify-center gap-3 mb-4 disabled:opacity-50 disabled:cursor-not-allowed">
                        <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /><path d="M1 1h22v22H1z" fill="none" /></svg>
                        Continue with Google
                    </button>

                    {/* Test buttons — only in development */}
                    {process.env.NODE_ENV === 'development' && (
                        <>
                            <button onClick={async () => {
                                await setDoc(doc(db, "users", "dummy_male"), { name: "Murtaza Test", gender: "male", itsNumber: "12345678", isItsVerified: true, isPremium: true, status: "verified", jamaat: "Test Jamaat Male", dob: "1995-01-01", hizratLocation: "Mumbai, India", education: "B.Tech Computer Science", libasImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop" });
                                setDummyUser("dummy_male", "dummy_male@test.com"); router.push("/");
                            }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold transition-all shadow-sm hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-3 mb-2">
                                Login as Dummy Male (Dev)
                            </button>
                            <button onClick={async () => {
                                await setDoc(doc(db, "users", "dummy_female"), { name: "Zahra Test", gender: "female", itsNumber: "87654321", isItsVerified: true, isPremium: true, status: "verified", jamaat: "Test Jamaat Female", dob: "1996-01-01", hizratLocation: "Dubai, UAE", education: "B.Sc Interior Design", libasImageUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop" });
                                setDummyUser("dummy_female", "dummy_female@test.com"); router.push("/");
                            }} className="w-full bg-pink-600 text-white py-3 rounded-xl font-bold transition-all shadow-sm hover:bg-pink-700 active:scale-95 flex items-center justify-center gap-3">
                                Login as Dummy Female (Dev)
                            </button>
                        </>
                    )}

                    <p className="text-xs text-center text-gray-400 mt-5">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
