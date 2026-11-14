"use client";

import React, { useEffect, useRef } from "react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { requestNotificationPermission, subscribeForegroundMessages, playNotificationChime } from "@/lib/firebase/messaging";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Bell, ArrowRight, X } from "lucide-react";

export default function PushNotificationHandler() {
    const { user } = useAuth();
    const router = useRouter();
    const initializedRef = useRef(false);

    useEffect(() => {
        if (!user?.uid) return;

        // Auto-sync token if permission is already granted (refreshes stale tokens silently)
        if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
                requestNotificationPermission(user.uid).catch((err) =>
                    console.warn("[PushHandler] Silent token sync warning:", err)
                );
            }
        }

        // Listen for manual request trigger (from any UI button or banner)
        const handleManualTrigger = async (e: any) => {
            const result = await requestNotificationPermission(user.uid);
            if (result.success) {
                toast.success("Push notifications enabled on this device!");
                playNotificationChime();
            } else if (result.reason === "Permission denied by user") {
                toast.error("Notifications are blocked in your browser settings. Please allow notifications for this site.");
            }
        };

        window.addEventListener("trigger-push-permission", handleManualTrigger);
        return () => {
            window.removeEventListener("trigger-push-permission", handleManualTrigger);
        };
    }, [user?.uid]);

    // Subscribe to foreground push notifications
    useEffect(() => {
        if (typeof window === "undefined") return;

        const unsubscribe = subscribeForegroundMessages((payload: any) => {
            const title = payload?.notification?.title || payload?.data?.title || "53DBohraRishta Notification";
            const body = payload?.notification?.body || payload?.data?.body || "";
            const targetUrl = payload?.data?.url || payload?.fcmOptions?.link || "/";

            // Render interactive floating toast
            toast.custom(
                (t) => (
                    <div
                        className={`${
                            t.visible ? "animate-enter" : "animate-leave"
                        } max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 p-3.5 border-2 border-[#881337]/30 transition-all`}
                        style={{
                            boxShadow: "0 20px 25px -5px rgba(136, 19, 55, 0.2), 0 8px 10px -6px rgba(136, 19, 55, 0.1)",
                        }}
                    >
                        <div className="flex-1 w-0 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#881337] text-white flex items-center justify-center shrink-0 font-bold font-serif text-sm shadow-md">
                                53
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-xs font-black text-[#881337] uppercase tracking-wider truncate">
                                        {title}
                                    </p>
                                </div>
                                <p className="text-xs text-gray-700 leading-snug line-clamp-2">
                                    {body}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 ml-3 shrink-0">
                            <button
                                onClick={() => {
                                    toast.dismiss(t.id);
                                    if (targetUrl) router.push(targetUrl);
                                }}
                                className="px-3 py-1.5 bg-[#881337] text-white rounded-xl text-xs font-bold hover:bg-[#70102d] transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                            >
                                <span>Open</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ),
                { duration: 8000, position: "top-right" }
            );

            // Also dispatch custom DOM event for active views (like chat window)
            window.dispatchEvent(new CustomEvent("foreground-push-received", { detail: payload }));
        });

        return () => {
            if (typeof unsubscribe === "function") unsubscribe();
        };
    }, [router]);

    return null;
}
