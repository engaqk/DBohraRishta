"use client";
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Coffee, Upload, QrCode, CheckCircle, X, Loader2, Copy, Sparkles, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CoffeeController() {
    const [settings, setSettings] = useState<{
        isCoffeeActive?: boolean;
        qrCodeImageUrl?: string;
        upiId?: string;
        coffeeTitle?: string;
        coffeeNote?: string;
    }>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form editing state
    const [isActive, setIsActive] = useState(false);
    const [qrCodeImageUrl, setQrCodeImageUrl] = useState('');
    const [upiId, setUpiId] = useState('');
    const [coffeeTitle, setCoffeeTitle] = useState('Buy Us a Coffee / Support Khidmat ☕');
    const [coffeeNote, setCoffeeNote] = useState('Support server & development costs for 53DBohraRishta.');

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system_settings', 'coffee'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setSettings(data);
                setIsActive(!!data.isCoffeeActive);
                setQrCodeImageUrl(data.qrCodeImageUrl || '');
                setUpiId(data.upiId || '');
                setCoffeeTitle(data.coffeeTitle || 'Buy Us a Coffee / Support Khidmat ☕');
                setCoffeeNote(data.coffeeNote || 'Support server & development costs for 53DBohraRishta.');
            } else {
                setSettings({ isCoffeeActive: false });
                setIsActive(false);
            }
        }, (err) => {
            console.error('Error listening to coffee settings:', err);
        });
        return () => unsub();
    }, []);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('Image size must be less than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setQrCodeImageUrl(base64);
            toast.success('QR Code image loaded! Click Save to apply.', { icon: '📸' });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/coffee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'secure_admin_session_active'
                },
                body: JSON.stringify({
                    isCoffeeActive: isActive,
                    qrCodeImageUrl,
                    upiId,
                    coffeeTitle,
                    coffeeNote
                })
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Coffee / UPI settings saved!', { icon: '☕' });
            } else {
                toast.error(data.error || 'Failed to save settings.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to connect to server.');
        } finally {
            setSaving(false);
        }
    };

    const isVisibleToUsers = isActive && Boolean(qrCodeImageUrl);

    return (
        <div className={`p-5 rounded-3xl border-2 transition-all shadow-sm mb-6 ${
            isVisibleToUsers
                ? 'bg-gradient-to-r from-amber-500/10 via-amber-50/40 to-yellow-500/10 border-amber-300'
                : 'bg-white border-gray-100 hover:border-gray-200'
        }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        isVisibleToUsers
                            ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-white animate-bounce'
                            : 'bg-gray-100 text-gray-400'
                    }`}>
                        <Coffee className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-base flex items-center gap-1.5">
                                Buy Us a Coffee / UPI QR Code Button
                            </h3>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                isVisibleToUsers
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : 'bg-gray-100 text-gray-500'
                            }`}>
                                {isVisibleToUsers ? 'Active & Visible' : 'Hidden from Users'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
                            {isVisibleToUsers ? (
                                <span className="text-amber-900 font-medium">
                                    ☕ <strong>Visible on Mobile & Desktop:</strong> Candidates see the &ldquo;Buy Us a Coffee&rdquo; button and can scan your uploaded UPI QR code to support platform khidmat.
                                </span>
                            ) : (
                                <span>
                                    Turn toggle ON and upload a valid UPI QR code image below to make the button visible to users.
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Toggle Switch */}
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-bold text-gray-600">
                        {isActive ? 'Button Enabled' : 'Button Disabled'}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsActive(!isActive)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isActive ? 'bg-amber-600' : 'bg-gray-200'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>
            </div>

            {/* Warning if toggle is ON but no QR code uploaded */}
            {isActive && !qrCodeImageUrl && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl mb-4 flex items-center gap-2.5 text-xs text-amber-800 font-medium">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Button will stay hidden until you upload and save a UPI QR code image below.</span>
                </div>
            )}

            {/* Inputs & QR Upload Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            UPI ID (Optional for 1-click copy)
                        </label>
                        <input
                            type="text"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="e.g. yourname@okhdfcbank or 9876543210@upi"
                            className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Modal Title
                        </label>
                        <input
                            type="text"
                            value={coffeeTitle}
                            onChange={(e) => setCoffeeTitle(e.target.value)}
                            placeholder="Buy Us a Coffee / Support Khidmat ☕"
                            className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Community Khidmat Message
                        </label>
                        <textarea
                            value={coffeeNote}
                            onChange={(e) => setCoffeeNote(e.target.value)}
                            rows={2}
                            placeholder="Support server and maintenance costs for 53DBohraRishta."
                            className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    {/* File Upload Button */}
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Upload UPI QR Code Image (GPay / PhonePe / Paytm)
                        </label>
                        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-amber-300 rounded-xl bg-amber-50/50 hover:bg-amber-50 cursor-pointer text-xs font-bold text-amber-900 transition-all">
                            <Upload className="w-4 h-4 text-amber-600" />
                            <span>{qrCodeImageUrl ? 'Change QR Code Image' : 'Select QR Code Image from Device'}</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>
                    </div>
                </div>

                {/* QR Code Preview Box */}
                <div className="flex flex-col items-center justify-center bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Live QR Code Preview</p>
                    {qrCodeImageUrl ? (
                        <div className="relative group">
                            <div className="w-44 h-44 bg-white p-2 rounded-2xl shadow-md border border-gray-200 overflow-hidden flex items-center justify-center">
                                <img
                                    src={qrCodeImageUrl}
                                    alt="UPI QR Code"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => setQrCodeImageUrl('')}
                                className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md hover:bg-rose-700"
                                title="Remove QR code"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-44 h-44 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center text-gray-400 p-4">
                            <QrCode className="w-10 h-10 mb-2 opacity-50" />
                            <span className="text-[11px] font-bold">No QR Code Image Uploaded</span>
                        </div>
                    )}
                    {upiId && (
                        <p className="text-xs font-mono font-bold text-gray-700 mt-2 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                            UPI: {upiId}
                        </p>
                    )}
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-3 mt-3 border-t border-gray-100">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#881337] hover:bg-[#9F1239] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Save Coffee & UPI Settings</span>
                </button>
            </div>
        </div>
    );
}
