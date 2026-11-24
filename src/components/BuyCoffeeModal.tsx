"use client";
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Zap, X, QrCode, Copy, Check, Heart, Sparkles, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export function useCoffeeSettings() {
    const [coffeeSettings, setCoffeeSettings] = useState<{
        isCoffeeActive?: boolean;
        qrCodeImageUrl?: string;
        upiId?: string;
        coffeeTitle?: string;
        coffeeNote?: string;
    }>({});

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system_settings', 'coffee'), (snap) => {
            if (snap.exists()) {
                setCoffeeSettings(snap.data());
            } else {
                setCoffeeSettings({ isCoffeeActive: false });
            }
        }, () => setCoffeeSettings({ isCoffeeActive: false }));
        return () => unsub();
    }, []);

    const isVisible = coffeeSettings.isCoffeeActive === true && Boolean(coffeeSettings.qrCodeImageUrl);

    return { coffeeSettings, isVisible };
}

export default function BuyCoffeeModal({
    isOpen,
    onClose,
    settings
}: {
    isOpen: boolean;
    onClose: () => void;
    settings?: {
        qrCodeImageUrl?: string;
        upiId?: string;
        coffeeTitle?: string;
        coffeeNote?: string;
    };
}) {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !settings?.qrCodeImageUrl) return null;

    const handleCopyUpi = () => {
        if (!settings.upiId) return;
        navigator.clipboard.writeText(settings.upiId);
        setCopied(true);
        toast.success(`UPI ID copied: ${settings.upiId}`, { icon: '📋' });
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 via-[#881337] to-[#5b0a20] text-white p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-amber-300 shadow-inner">
                            <Zap className="w-5 h-5 fill-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base font-serif leading-tight">
                                {settings.coffeeTitle || '⚡ Fuel Platform Tech'}
                            </h3>
                            <p className="text-[11px] text-amber-200 mt-0.5">Power Next-Gen Features & Khidmat</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col items-center text-center space-y-4">
                    <p className="text-xs text-gray-600 leading-relaxed max-w-xs">
                        {settings.coffeeNote || 'We are building world-class AI matching, instant verification, and privacy tools for our community. Your voluntary support directly powers our next wave of groundbreaking features.'}
                    </p>

                    {/* QR Code Container */}
                    <div className="bg-gradient-to-tr from-amber-50 to-yellow-50 p-3 rounded-2xl border-2 border-amber-200 shadow-md flex flex-col items-center">
                        <div className="w-52 h-52 bg-white rounded-xl p-2 shadow-inner flex items-center justify-center overflow-hidden">
                            <img
                                src={settings.qrCodeImageUrl}
                                alt="UPI QR Code"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <p className="text-[10px] font-black text-amber-900 mt-2 uppercase tracking-wider flex items-center gap-1">
                            <span>Scan with any UPI App</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 opacity-70 text-[9px] font-bold text-gray-600">
                            <span>GPay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>BHIM</span>
                        </div>
                    </div>

                    {/* UPI ID with 1-Click Copy */}
                    {settings.upiId && (
                        <div className="w-full bg-gray-50 border border-gray-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                            <div className="text-left overflow-hidden">
                                <p className="text-[9px] uppercase font-bold text-gray-400">UPI ID</p>
                                <p className="text-xs font-mono font-bold text-gray-800 truncate">{settings.upiId}</p>
                            </div>
                            <button
                                onClick={handleCopyUpi}
                                className="bg-[#881337] hover:bg-[#9F1239] text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                            >
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{copied ? 'Copied!' : 'Copy'}</span>
                            </button>
                        </div>
                    )}

                    <div className="bg-amber-50/70 border border-amber-200/60 p-3 rounded-xl text-left w-full">
                        <p className="text-[11px] text-amber-900 font-medium leading-relaxed italic text-center">
                            &ldquo;JazakAllah Khair! May Allah Ta&apos;ala bless your contribution with abundance and barakat.&rdquo;
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
