"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Download, Apple, ShieldCheck, Zap, Bell, Camera, ArrowLeft, CheckCircle2, Sparkles, Share2, PlusSquare } from 'lucide-react';

export default function DownloadAppPage() {
    const [isAndroid, setIsAndroid] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const ua = navigator.userAgent || '';
            setIsAndroid(/android/i.test(ua));
            setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream);
        }
    }, []);

    const handleDownloadApk = () => {
        setDownloading(true);
        // Direct link to the hosted APK
        const link = document.createElement('a');
        link.href = '/downloads/53DBohraRishta.apk';
        link.download = '53DBohraRishta.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => setDownloading(false), 3000);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFF1F2] via-white to-[#FFFBEB] text-gray-800 flex flex-col font-sans">
            {/* Top Navigation */}
            <header className="bg-gradient-to-r from-[#881337] via-[#9F1239] to-[#881337] text-white py-4 px-6 shadow-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <Link href="/" className="inline-flex items-center gap-2 text-rose-100 hover:text-white transition-colors text-xs font-bold">
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Dashboard</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-black uppercase tracking-wider text-[#D4AF37]">Official Mobile Apps</span>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="max-w-5xl mx-auto px-4 py-8 md:py-12 flex-1 w-full">
                <div className="text-center max-w-2xl mx-auto mb-10">
                    <div className="inline-flex items-center gap-1.5 bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#881337] px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-4 shadow-xs">
                        <Sparkles className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37]" /> 100% Free • Dawoodi Bohra Rishta Platform
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black font-serif text-[#881337] leading-tight mb-4">
                        Download 53DBohraRishta Mobile App
                    </h1>
                    <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                        Experience lightning-fast matchmaking with native camera selfie verification, real-time push notifications, voice intros, and instant updates on your smartphone.
                    </p>
                </div>

                {/* Platform Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {/* Android Card */}
                    <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 transition-all relative overflow-hidden flex flex-col justify-between ${isAndroid ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-[#D4AF37]/40 hover:border-[#881337]'}`}>
                        {isAndroid && (
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                                Detected Device
                            </div>
                        )}
                        <div>
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <Smartphone className="w-7 h-7" />
                            </div>
                            <h2 className="text-2xl font-bold font-serif text-gray-900 mb-2">Android App</h2>
                            <p className="text-xs text-gray-500 mb-6 font-medium">
                                Direct standalone APK • Version 1.0 • 6.4 MB • Zero subscription fees
                            </p>

                            <ul className="space-y-3 text-xs text-gray-600 mb-8">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Direct installation without Google Play sign-in required</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Instant live sync with Vercel for zero-delay feature updates</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Real-time push notifications for chat & interest requests</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>Native camera & microphone for verified selfies & voice notes</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <button
                                onClick={handleDownloadApk}
                                disabled={downloading}
                                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
                            >
                                <Download className="w-5 h-5" />
                                <span>{downloading ? 'Downloading APK...' : 'Download Android App (.apk)'}</span>
                            </button>
                            <p className="text-[11px] text-gray-400 text-center mt-3">
                                Tap <strong>Open</strong> after download & select <strong>Install</strong> when prompted.
                            </p>
                        </div>
                    </div>

                    {/* iOS Card */}
                    <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 transition-all relative overflow-hidden flex flex-col justify-between ${isIOS ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-[#D4AF37]/40 hover:border-[#881337]'}`}>
                        {isIOS && (
                            <div className="absolute top-4 right-4 bg-sky-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-sm">
                                Detected Device
                            </div>
                        )}
                        <div>
                            <div className="w-14 h-14 bg-gray-100 text-gray-900 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                <Apple className="w-7 h-7" />
                            </div>
                            <h2 className="text-2xl font-bold font-serif text-gray-900 mb-2">iOS (iPhone & iPad)</h2>
                            <p className="text-xs text-gray-500 mb-6 font-medium">
                                Standalone Full-Screen App • Native Apple Icon • Zero App Store fees
                            </p>

                            <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 mb-6 text-xs text-gray-700 space-y-2.5">
                                <p className="font-bold text-[#881337]">How to install on your iPhone in 3 steps:</p>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-[#881337] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                                    <span>Open <strong>53dbohrarishta.in</strong> in <strong>Safari</strong> on your iPhone.</span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-[#881337] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                                    <span className="flex items-center gap-1 flex-wrap">
                                        Tap the <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline text-sky-600" /> at bottom of Safari.
                                    </span>
                                </div>
                                <div className="flex items-start gap-2.5">
                                    <span className="w-5 h-5 rounded-full bg-[#881337] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                                    <span className="flex items-center gap-1 flex-wrap">
                                        Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-gray-700" /> <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
                                    </span>
                                </div>
                            </div>

                            <ul className="space-y-3 text-xs text-gray-600 mb-8">
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span>Launches full-screen like a native app (no Safari address bar)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span>Real-time iOS Web Push Notifications (iOS 16.4+)</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
                                    <span>Always up-to-date with the latest verified community profiles</span>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <Link
                                href="/"
                                className="w-full bg-gradient-to-r from-gray-900 to-gray-800 hover:from-black hover:to-gray-900 text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer"
                            >
                                <Apple className="w-5 h-5" />
                                <span>Launch App on iPhone</span>
                            </Link>
                            <p className="text-[11px] text-gray-400 text-center mt-3">
                                Follow the 3 steps above in Safari to pin to your Home Screen.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Features Banner */}
                <div className="mt-12 bg-white rounded-3xl p-6 sm:p-8 border border-rose-100 shadow-sm max-w-4xl mx-auto">
                    <h3 className="text-center font-serif font-bold text-xl text-[#881337] mb-6">
                        Why Use the 53DBohraRishta Mobile App?
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-rose-50 text-[#881337] rounded-2xl flex items-center justify-center mb-3">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 mb-1">ITS Verified & Halal</h4>
                            <p className="text-xs text-gray-500">
                                100% genuine Dawoodi Bohra community members with blur privacy protection.
                            </p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-amber-50 text-[#D4AF37] rounded-2xl flex items-center justify-center mb-3">
                                <Zap className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 mb-1">Instant Vercel Sync</h4>
                            <p className="text-xs text-gray-500">
                                Zero-delay updates. New features and direct chat windows load automatically.
                            </p>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-3">
                                <Bell className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 mb-1">Real-Time Alerts</h4>
                            <p className="text-xs text-gray-500">
                                Push notifications for incoming interests, direct messages, and admin verifications.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-6 text-center text-xs text-gray-400 border-t border-rose-100 bg-white">
                <p>© {new Date().getFullYear()} 53DBohraRishta Platform. Free community service for Dawoodi Bohra members worldwide.</p>
            </footer>
        </div>
    );
}
