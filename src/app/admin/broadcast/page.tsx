"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Send, Bell, Mail, Loader2, ArrowLeft, Megaphone, CheckCircle2, History } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";

interface BroadcastHistory {
    id: string;
    title: string;
    message: string;
    createdAt: any;
    stats?: {
        total: number;
    };
}

export default function AdminBroadcastPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<BroadcastHistory[]>([]);
    const [formData, setFormData] = useState({
        title: "",
        message: "",
        sendPush: true,
        sendInApp: true,
        sendEmail: false,
    });

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const q = query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(5));
            const snap = await getDocs(q);
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as BroadcastHistory)));
        } catch (e) {
            console.error(e);
        }
    };

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.message) {
            toast.error("Please fill title and message");
            return;
        }

        const confirm = window.confirm(`Are you sure you want to send this broadcast to ALL users? This action cannot be undone.`);
        if (!confirm) return;

        setLoading(true);
        try {
            // 1. Save to Broadcasts collection (for history and in-app display)
            const broadcastDoc = await addDoc(collection(db, "broadcasts"), {
                title: formData.title,
                message: formData.message,
                adminId: user?.uid,
                createdAt: serverTimestamp(),
                delivery: {
                    push: formData.sendPush,
                    inApp: formData.sendInApp,
                    email: formData.sendEmail
                }
            });

            // 2. Trigger Cloud Function or API route for mass delivery
            const res = await fetch('/api/broadcast/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: formData.title,
                    message: formData.message,
                    sendPush: formData.sendPush,
                    sendInApp: formData.sendInApp,
                    sendEmail: formData.sendEmail,
                    adminId: user?.uid
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to send mass broadcast via API');
            }

            const data = await res.json();
            console.log("Broadcast success:", data);

            toast.success(`Broadcast sent! Push: ${data.pushSent}, Emails: ${data.emailsSent}`);
            setFormData({ title: "", message: "", sendPush: true, sendInApp: true, sendEmail: false });
            fetchHistory();
        } catch (error: any) {
            toast.error("Failed to send broadcast: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-4xl w-full mx-auto">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#881337] font-bold mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>

                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-[#881337] rounded-2xl flex items-center justify-center shadow-lg">
                        <Megaphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif">Broadcast Notifications</h1>
                        <p className="text-gray-500 text-sm">Send platform-wide announcements to all members.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={handleSend} className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Subject / Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Eid Mubarak to all members!"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Message Content</label>
                                <textarea
                                    rows={5}
                                    value={formData.message}
                                    onChange={e => setFormData({ ...formData, message: e.target.value })}
                                    placeholder="Write your announcement details here..."
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none resize-none transition-all"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Delivery Channels</label>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, sendInApp: !formData.sendInApp })}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.sendInApp ? 'border-[#881337] bg-rose-50 text-[#881337]' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                    >
                                        <Bell className="w-5 h-5" />
                                        <div className="text-left">
                                            <p className="text-xs font-black uppercase">In-App</p>
                                            <p className="text-[10px] opacity-70">Dashboard Banner</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, sendPush: !formData.sendPush })}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.sendPush ? 'border-[#881337] bg-rose-50 text-[#881337]' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                    >
                                        <Megaphone className="w-5 h-5" />
                                        <div className="text-left">
                                            <p className="text-xs font-black uppercase">Push</p>
                                            <p className="text-[10px] opacity-70">Browser Alert</p>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, sendEmail: !formData.sendEmail })}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${formData.sendEmail ? 'border-[#881337] bg-rose-50 text-[#881337]' : 'border-gray-100 bg-gray-50 text-gray-400'}`}
                                    >
                                        <Mail className="w-5 h-5" />
                                        <div className="text-left">
                                            <p className="text-xs font-black uppercase">Email</p>
                                            <p className="text-[10px] opacity-70">Direct Inbox</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#881337] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#70102d] transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                                {loading ? "Broadcasting..." : "Launch Announcement"}
                            </button>
                        </form>
                    </div>

                    {/* Sidebar / History */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6">
                            <h2 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
                                <History className="w-4 h-4" /> Recent Activity
                            </h2>

                            {history.length === 0 ? (
                                <p className="text-xs text-center text-gray-400 py-8 italic">No previous broadcasts found.</p>
                            ) : (
                                <div className="space-y-4">
                                    {history.map(item => (
                                        <div key={item.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="flex items-center justify-between mb-1">
                                                <p className="text-xs font-bold truncate pr-2">{item.title}</p>
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                            </div>
                                            <p className="text-[10px] text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                                                {item.message}
                                            </p>
                                            <p className="text-[9px] text-gray-400 font-medium">
                                                {item.createdAt?.toDate().toLocaleDateString()} at {item.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
                            <h3 className="text-xs font-black uppercase text-amber-800 mb-2">Pro Tip</h3>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                Avoid over-broadcasting. Use "Push" only for urgent updates or festival greetings to maintain high engagement rates.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
