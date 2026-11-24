"use client";
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Sparkles, Clock, ShieldCheck, CheckCircle, X, Bell, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SoulSyncController() {
    const [settings, setSettings] = useState<{
        isSoulSyncActive?: boolean;
        dropHour?: number;
        enabledAt?: any;
    }>({});
    const [loading, setLoading] = useState(false);
    const [notifyUsers, setNotifyUsers] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system_settings', 'soulsync'), (snap) => {
            if (snap.exists()) {
                setSettings(snap.data() as any);
            } else {
                setSettings({ isSoulSyncActive: false });
            }
        }, (err) => {
            console.error('Error listening to soulsync setting:', err);
        });
        return () => unsub();
    }, []);

    const handleToggle = async (targetState: boolean) => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/soulsync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'secure_admin_session_active'
                },
                body: JSON.stringify({
                    isSoulSyncActive: targetState,
                    notifyUsers: targetState && notifyUsers
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || (targetState ? "SoulSync enabled!" : "SoulSync disabled."));
            } else {
                toast.error(data.error || "Failed to update SoulSync setting.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to connect to server.");
        } finally {
            setLoading(false);
        }
    };

    const isActive = !!settings.isSoulSyncActive;

    return (
        <div className={`p-5 rounded-3xl border-2 transition-all shadow-sm mb-6 ${
            isActive 
                ? 'bg-gradient-to-r from-amber-500/10 via-rose-50 to-amber-500/10 border-amber-300' 
                : 'bg-white border-gray-100 hover:border-gray-200'
        }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        isActive 
                            ? 'bg-gradient-to-br from-amber-400 to-[#881337] text-white animate-pulse' 
                            : 'bg-gray-100 text-gray-400'
                    }`}>
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                                SoulSync ✨ (8:00 PM Daily Drop)
                            </h3>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isActive 
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                                    : 'bg-gray-100 text-gray-500'
                            }`}>
                                {isActive ? 'Live & Active' : 'Feature Disabled'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
                            {isActive ? (
                                <span className="text-amber-900 font-medium">
                                    🌟 <strong>Active for Verified Candidates:</strong> Daily 3 handpicked alignments with 3 Halal Icebreaker cards and 8:00 PM habit loop.
                                </span>
                            ) : (
                                <span>
                                    Curated daily 3-match drop with interactive icebreakers. Only visible to verified candidates when turned ON.
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {isActive ? (
                        <button
                            onClick={() => handleToggle(false)}
                            disabled={loading}
                            className="w-full sm:w-auto bg-white border border-rose-200 text-red-600 hover:bg-red-50 active:scale-95 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            <span>Disable SoulSync</span>
                        </button>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-end gap-2 w-full sm:w-auto">
                            <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={notifyUsers} 
                                    onChange={(e) => setNotifyUsers(e.target.checked)} 
                                    className="rounded text-[#881337] focus:ring-[#881337]"
                                />
                                <span>Notify verified candidates</span>
                            </label>
                            <button
                                onClick={() => handleToggle(true)}
                                disabled={loading}
                                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-[#881337] hover:from-amber-600 hover:to-[#9F1239] text-white active:scale-95 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                <span>Enable SoulSync Drop</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
