"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if already dismissed in this session
        const wasDismissed = sessionStorage.getItem("pwa_banner_dismissed");
        if (wasDismissed) {
            // But we still want to listen for manual triggers
        } else {
            // Initial check for show
            const isStandalone =
                window.matchMedia("(display-mode: standalone)").matches ||
                (window.navigator as any).standalone === true;
            if (!isStandalone) {
                // Initial delay for auto-show banner
                setTimeout(() => {
                    if (!sessionStorage.getItem("pwa_banner_dismissed")) setShowBanner(true);
                }, 8000);
            }
        }

        // Detect iOS separately since it doesn't support beforeinstallprompt
        const ua = navigator.userAgent;
        const isIOSDevice = /iPhone|iPad|iPod/i.test(ua) && !(window.navigator as any).standalone;
        setIsIOS(isIOSDevice);

        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            // Don't auto-show here if dismissed, wait for trigger or initial timer
        };

        const triggerHandler = () => {
            setDismissed(false);
            setShowBanner(true);
            sessionStorage.removeItem("pwa_banner_dismissed");
        };

        window.addEventListener("beforeinstallprompt", handler as EventListener);
        window.addEventListener("trigger-pwa-install", triggerHandler);
        
        return () => {
            window.removeEventListener("beforeinstallprompt", handler as EventListener);
            window.removeEventListener("trigger-pwa-install", triggerHandler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
            setShowBanner(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setDismissed(true);
        sessionStorage.setItem("pwa_banner_dismissed", "1");
    };

    if (!showBanner || dismissed) return null;

    return (
        <div
            className="fixed bottom-4 left-4 right-4 z-[9000] max-w-md mx-auto animate-in slide-in-from-bottom-4 duration-500"
            role="dialog"
            aria-label="Install App"
        >
            <div className="bg-white border border-[#881337]/20 rounded-2xl shadow-2xl shadow-rose-900/20 p-4 flex items-center gap-4">
                {/* App Icon */}
                <div className="w-12 h-12 bg-[#881337] rounded-xl flex items-center justify-center shrink-0 shadow-md">
                    <span className="text-white font-bold text-lg font-serif">53</span>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#881337] text-sm">Install DBohraRishta</p>
                    {isIOS ? (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                            Tap <strong>Share</strong> then <strong>"Add to Home Screen"</strong> to install.
                        </p>
                    ) : (
                        <p className="text-xs text-gray-500 mt-0.5">
                            Add to your home screen for faster access.
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {!isIOS && (
                        <button
                            onClick={handleInstall}
                            id="pwa-install-btn"
                            className="flex items-center gap-1.5 bg-[#881337] text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-[#70102d] active:scale-95 transition-all shadow-sm"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Install
                        </button>
                    )}
                    {isIOS && (
                        <div className="flex items-center gap-1 bg-rose-50 text-[#881337] px-2 py-1.5 rounded-lg border border-rose-100">
                            <Smartphone className="w-4 h-4" />
                        </div>
                    )}
                    <button
                        onClick={handleDismiss}
                        id="pwa-dismiss-btn"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
