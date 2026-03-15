"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Send, Loader2, ArrowLeft, Smartphone, CheckCircle2, History, MessageSquare, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

interface SmsBroadcastHistory {
    id: string;
    message: string;
    sent: number;
    failed: number;
    totalFound: number;
    createdAt: any;
}

export default function AdminSmsBroadcastPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [history, setHistory] = useState<SmsBroadcastHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [charCount, setCharCount] = useState(0);

    const MAX_SMS_LENGTH = 160;

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "sms_broadcasts"), orderBy("createdAt", "desc"), limit(10));
            const snap = await getDocs(q);
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as SmsBroadcastHistory)));
        } catch (e) {
            console.error("Failed to fetch SMS history:", e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) {
            toast.error("Please enter a message before sending.");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to send this SMS to ALL registered mobile numbers?\n\nMessage:\n"${message.trim()}"\n\nThis action cannot be undone.`
        );
        if (!confirmed) return;

        setLoading(true);
        try {
            const res = await fetch('/api/admin/sms-broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message.trim(),
                    adminId: user?.uid || 'admin',
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to send SMS broadcast');
            }

            toast.success(`✅ SMS Broadcast sent to ${data.sent} numbers! (${data.failed} failed)`);
            setMessage("");
            setCharCount(0);
            fetchHistory();
        } catch (error: any) {
            toast.error("SMS Broadcast failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleMessageChange = (val: string) => {
        setMessage(val);
        setCharCount(val.length);
    };

    const smsCount = Math.ceil(charCount / MAX_SMS_LENGTH) || 1;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-4xl w-full mx-auto">
                {/* Back Button */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#881337] font-bold mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#881337] to-rose-800 rounded-2xl flex items-center justify-center shadow-lg">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif">SMS Broadcast</h1>
                        <p className="text-gray-500 text-sm">Send an SMS message to all registered mobile numbers via Textbee.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Compose Section */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSend} className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">

                            {/* Info Box */}
                            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs text-amber-800 leading-relaxed">
                                    <p className="font-bold mb-1">How it works</p>
                                    <p>This will fetch all registered mobile numbers from the database and send each one an SMS via your Textbee device gateway. STandard SMS charges from your SIM apply.</p>
                                </div>
                            </div>

                            {/* Message Field */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">
                                    Message Body
                                </label>
                                <textarea
                                    rows={6}
                                    value={message}
                                    onChange={e => handleMessageChange(e.target.value)}
                                    placeholder="e.g. Eid Mubarak from 53DBohraRishta! 🌙 Wishing all members and their families a blessed Eid. Visit our platform at 53dbohrarishta.in"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none resize-none transition-all text-sm leading-relaxed"
                                    required
                                />
                                {/* Character counter */}
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-xs text-gray-400">
                                        {smsCount > 1 ? (
                                            <span className="text-orange-500 font-bold">⚠ Will be sent as {smsCount} SMS parts</span>
                                        ) : (
                                            <span>Standard SMS (max 160 chars per part)</span>
                                        )}
                                    </p>
                                    <p className={`text-xs font-bold tabular-nums ${charCount > MAX_SMS_LENGTH ? 'text-orange-500' : 'text-gray-400'}`}>
                                        {charCount}/{MAX_SMS_LENGTH}
                                    </p>
                                </div>
                            </div>

                            {/* Send Button */}
                            <button
                                type="submit"
                                id="sms-broadcast-send-btn"
                                disabled={loading || !message.trim()}
                                className="w-full bg-[#881337] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#70102d] transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Sending SMS Broadcast...</>
                                ) : (
                                    <><Send className="w-5 h-5" /> Send to All Registered Numbers</>
                                )}
                            </button>
                        </form>
                    </div>

                    {/* Sidebar / History */}
                    <div className="space-y-6">
                        {/* Stats Card */}
                        <div className="bg-gradient-to-br from-[#881337] to-rose-900 rounded-3xl p-6 text-white shadow-xl">
                            <div className="flex items-center gap-2 mb-2">
                                <MessageSquare className="w-5 h-5 opacity-80" />
                                <p className="text-xs font-black uppercase tracking-widest opacity-80">Via Textbee</p>
                            </div>
                            <p className="text-sm leading-relaxed opacity-90">
                                Messages are sent through your linked Android device running the Textbee app.
                            </p>
                            <div className="mt-4 pt-4 border-t border-white/20">
                                <p className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Powered by</p>
                                <p className="font-bold text-lg">textbee.dev</p>
                            </div>
                        </div>

                        {/* History */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                                <History className="w-4 h-4" /> Recent SMS Broadcasts
                            </h2>

                            {historyLoading ? (
                                <div className="text-center py-6">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300" />
                                </div>
                            ) : history.length === 0 ? (
                                <p className="text-xs text-center text-gray-400 py-8 italic">
                                    No SMS broadcasts sent yet.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {history.map(item => (
                                        <div key={item.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                    <p className="text-[10px] font-bold text-emerald-600">
                                                        {item.sent ?? '—'} sent
                                                        {item.failed > 0 && <span className="text-orange-500 ml-1">• {item.failed} failed</span>}
                                                    </p>
                                                </div>
                                                <p className="text-[9px] text-gray-400 font-medium tabular-nums">
                                                    {item.createdAt?.toDate?.()?.toLocaleDateString()}
                                                </p>
                                            </div>
                                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed mt-1">
                                                {item.message}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pro Tip */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
                            <h3 className="text-xs font-black uppercase text-amber-800 mb-2">💡 Pro Tips</h3>
                            <ul className="text-xs text-amber-700 leading-relaxed space-y-1 list-disc list-inside">
                                <li>Keep messages under 160 characters to avoid splitting.</li>
                                <li>Use SMS for urgent or festival announcements only.</li>
                                <li>Standard SMS rates from your SIM apply per message.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
