"use client";

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";

export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        const wasDismissed = sessionStorage.getItem("pwa_banner_dismissed");
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            (window.navigator as any).standalone === true;

        if (isStandalone) return;

        // Detect iOS separately
        const ua = navigator.userAgent;
        const isIOSDevice = /iPhone|iPad|iPod/i.test(ua) && !(window.navigator as any).standalone;
        setIsIOS(isIOSDevice);

        if (isIOSDevice && !sessionStorage.getItem("pwa_banner_dismissed")) {
            // iOS doesn't have beforeinstallprompt, so we use a short delay
            setTimeout(() => setShowBanner(true), 3000);
        }

        const triggerHandler = () => {
            console.log('[PWA Banner] Manual trigger received. Clearing dismissal and showing banner.');
            setDismissed(false);
            setShowBanner(true);
            sessionStorage.removeItem("pwa_banner_dismissed");
        };

        const handler = (e: any) => {
            const dismissedStatus = sessionStorage.getItem("pwa_banner_dismissed");
            console.log('[PWA Banner] beforeinstallprompt event fired. Dismissed status:', dismissedStatus);
            e.preventDefault();
            setDeferredPrompt(e);
            if (!dismissedStatus) {
                console.log('[PWA Banner] Showing banner automatically.');
                setShowBanner(true);
            }
        };

        // For debugging: expose force show to window
        (window as any).__FORCE_SHOW_PWA_BANNER = triggerHandler;

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
            <div 
                className="bg-white rounded-2xl p-4 flex items-center gap-4"
                style={{ 
                    border: '1px solid #ffe4e6', 
                    boxShadow: '0 20px 25px -5px rgba(136, 19, 55, 0.1), 0 8px 10px -6px rgba(136, 19, 55, 0.1)' 
                }}
            >
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
                        <div 
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg"
                            style={{ backgroundColor: '#fff1f2', color: '#881337', border: '1px solid #ffe4e6' }}
                        >
                            <Smartphone className="w-4 h-4" />
                        </div>
                    )}
                    <button
                        onClick={handleDismiss}
                        id="pwa-dismiss-btn"
                        className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                        aria-label="Dismiss"
                        style={{ backgroundColor: '#f9fafb' }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
