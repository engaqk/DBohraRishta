"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { UserMinus, ShieldAlert } from "lucide-react";

export default function ImpersonationBanner() {
    const { isImpersonating, user, stopImpersonating } = useAuth();

    if (!isImpersonating) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-[#D4AF37] text-white px-4 py-2 flex items-center justify-between shadow-2xl border-b border-white/20 animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-1.5 rounded-lg">
                    <ShieldAlert className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-none opacity-80">Admin Mode (Master User)</p>
                    <p className="text-xs font-bold leading-tight">Impersonating: <span className="underline decoration-white/30">{user?.email}</span></p>
                </div>
            </div>
            <button
                onClick={stopImpersonating}
                className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 flex items-center gap-2 active:scale-95"
            >
                <UserMinus className="w-3.5 h-3.5" /> Stop / Revert
            </button>
        </div>
    );
}
