"use client";
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { MessageSquare, Sparkles, Clock, AlertTriangle, ShieldCheck, Mail, CheckCircle, X, Send, Eye, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OpenChatController() {
    const [settings, setSettings] = useState<{
        isOpenChatActive?: boolean;
        expiresAt?: string | null;
        enabledAt?: string | null;
        durationHours?: number | null;
        durationLabel?: string;
        customNote?: string;
    }>({});
    const [loading, setLoading] = useState(false);
    const [durationHours, setDurationHours] = useState<number | null>(null);
    const [durationLabel, setDurationLabel] = useState<string>('Open Now (Take Benefit ASAP)');
    const [sendEmail, setSendEmail] = useState(true);
    const [customNote, setCustomNote] = useState('');
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [timeLeftStr, setTimeLeftStr] = useState<string>('');

    // Real-time listener for chat_window doc in system_settings
    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'system_settings', 'chat_window'), (snap) => {
            if (snap.exists()) {
                setSettings(snap.data() as any);
            } else {
                setSettings({ isOpenChatActive: false });
            }
        }, (err) => {
            console.error('Error listening to chat_window setting:', err);
        });
        return () => unsub();
    }, []);

    // Live countdown calculation
    useEffect(() => {
        if (!settings.isOpenChatActive) {
            setTimeLeftStr('');
            return;
        }

        if (!settings.expiresAt) {
            setTimeLeftStr('Open Now — Connect ASAP');
            return;
        }

        const updateCountdown = () => {
            const diff = new Date(settings.expiresAt!).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeftStr('Expired');
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const secs = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeftStr(`${hours}h ${mins}m ${secs}s remaining`);
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [settings.isOpenChatActive, settings.expiresAt]);

    const handleToggle = async (targetState: boolean) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token') || 'secure_admin_session_active';
            const res = await fetch('/api/admin/open-chat', {
                method: 'POST',
                headers: {
                    'Authorization': token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    enabled: targetState,
                    durationHours: targetState ? durationHours : null,
                    durationLabel: targetState ? durationLabel : 'Until Manually Disabled',
                    sendEmail: targetState ? sendEmail : false,
                    customNote: targetState ? customNote.trim() : ''
                })
            });

            const data = await res.json();
            if (data.success) {
                if (targetState) {
                    toast.success(`Open Chat Window Activated! ${data.emailsSent ? `Emails sent to ${data.emailsSent} verified candidates.` : ''}`);
                } else {
                    toast.success('Open Chat Window Deactivated. Restored strict approval mode.');
                }
            } else {
                toast.error(data.error || 'Failed to update setting');
            }
        } catch (e: any) {
            console.error('Error toggling open chat:', e);
            toast.error(e.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    const isLive = !!settings.isOpenChatActive && (!settings.expiresAt || new Date(settings.expiresAt).getTime() > Date.now());

    return (
        <div className="mb-8 bg-white border border-rose-100 rounded-3xl p-6 shadow-sm relative overflow-hidden transition-all">
            {/* Background Accent */}
            <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20 ${isLive ? 'bg-emerald-400' : 'bg-rose-400'}`} />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                {/* Left Info */}
                <div className="flex items-start gap-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isLive ? 'bg-emerald-500 text-white animate-pulse' : 'bg-rose-50 text-[#881337]'}`}>
                        <MessageSquare className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold font-serif text-gray-900">
                                Open Chat Window
                            </h3>
                            {isLive ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                                    Live & Active
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                    Disabled (Strict Approval Mode)
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 max-w-2xl leading-relaxed">
                            {isLive
                                ? "All registered and verified candidates can currently chat directly without requiring mutual interest approvals."
                                : "When enabled, all verified candidates can message each other directly for testing and community interaction. When disabled, strict interest-acceptance rules remain intact."
                            }
                        </p>
                        {isLive && (
                            <div className="mt-3 inline-flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3.5 py-1.5 rounded-xl text-xs font-bold">
                                <Clock className="w-4 h-4 text-emerald-600" />
                                <span>{timeLeftStr}</span>
                                {settings.durationLabel && <span className="text-emerald-700 font-normal">({settings.durationLabel})</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Action */}
                <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                    {isLive ? (
                        <button
                            onClick={() => handleToggle(false)}
                            disabled={loading}
                            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-6 py-3 rounded-2xl text-sm shadow-md transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            End Open Chat Now
                        </button>
                    ) : (
                        <button
                            onClick={() => handleToggle(true)}
                            disabled={loading}
                            className="bg-gradient-to-r from-[#881337] to-[#9F1239] hover:from-[#9F1239] hover:to-[#881337] active:scale-95 text-white font-bold px-7 py-3 rounded-2xl text-sm shadow-lg transition-all flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-yellow-300" />}
                            Activate Open Chat Window
                        </button>
                    )}
                </div>
            </div>

            {/* Timing & Email Controls (Only visible when currently Disabled) */}
            {!isLive && (
                <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 text-left">
                    {/* Duration Picker */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                            ⏱️ Keep Enabled For:
                        </label>
                        <select
                            value={durationHours === null ? 'indefinite' : durationHours}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'indefinite') {
                                    setDurationHours(null);
                                    setDurationLabel('Open Now (Take Benefit ASAP)');
                                } else {
                                    const num = Number(val);
                                    setDurationHours(num);
                                    setDurationLabel(`${num} Hour${num > 1 ? 's' : ''}`);
                                }
                            }}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#881337]/20 focus:border-[#881337]"
                        >
                            <option value="indefinite">♾️ Open Now (No Expiry Set — Connect ASAP)</option>
                            <option value="1">1 Hour (Quick Test)</option>
                            <option value="2">2 Hours</option>
                            <option value="4">4 Hours</option>
                            <option value="12">12 Hours (Half Day)</option>
                            <option value="24">24 Hours (Full Day Special)</option>
                            <option value="48">48 Hours (Weekend Window)</option>
                        </select>
                        <p className="text-[11px] text-gray-400 mt-1.5">
                            Auto-closes when time expires, or can be turned off anytime manually.
                        </p>
                    </div>

                    {/* Email Blast Option */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                            📧 Notification Announcement:
                        </label>
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={sendEmail}
                                    onChange={(e) => setSendEmail(e.target.checked)}
                                    className="w-4 h-4 text-[#881337] rounded border-gray-300 focus:ring-[#881337]"
                                />
                                <span className="text-xs font-bold text-gray-800">
                                    Email all verified candidates
                                </span>
                            </label>
                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-200/60">
                                <span>Includes respectful adab guidelines</span>
                                <button
                                    type="button"
                                    onClick={() => setShowPreviewModal(true)}
                                    className="text-[#881337] font-bold hover:underline flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3" /> Preview Email
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Optional Custom Note */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">
                            📝 Announcement Note (Optional):
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. Special weekend open chat opportunity!"
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#881337]/20 focus:border-[#881337]"
                        />
                        <p className="text-[11px] text-gray-400 mt-1.5">
                            Displayed inside the candidate announcement banner & email.
                        </p>
                    </div>
                </div>
            )}

            {/* Email Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-xl w-full p-6 max-h-[85vh] overflow-y-auto text-left shadow-2xl relative">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-4">
                            <h4 className="font-bold font-serif text-lg text-[#881337] flex items-center gap-2">
                                <Mail className="w-5 h-5 text-[#881337]" />
                                Email Announcement Preview
                            </h4>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-200">
                            <div className="border-b border-gray-200 pb-2">
                                <p><span className="font-bold text-gray-700">Subject:</span> ✨ Special Open Chat Window is LIVE! Connect Directly on 53DBohraRishta</p>
                                <p><span className="font-bold text-gray-700">Recipients:</span> All Registered & Verified Candidates Only</p>
                                <p><span className="font-bold text-gray-700">Duration:</span> {durationHours ? `Next ${durationLabel}` : 'Open Now (Take Benefit ASAP)'}</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                                <p className="font-bold text-[#881337] text-sm">Assalamu Alaikum wa Rahmatullah,</p>
                                <p>Alhamdulillah, the <strong>Direct Chat Window is currently open for all verified community members</strong> to communicate directly with candidates of interest!</p>
                                <div className="bg-amber-50 p-3 rounded-lg border-l-4 border-amber-400">
                                    <p className="font-bold text-amber-900">
                                        ⏳ {durationHours ? `Currently open for the next ${durationLabel}! Take full benefit today.` : 'Currently Open Now — Take benefit to connect with your interest as soon as possible!'}
                                    </p>
                                    {customNote && <p className="italic text-amber-800 mt-1">"{customNote}"</p>}
                                </div>
                                <p className="font-bold text-gray-800">🤝 Islamic Adab & Etiquette Reminder:</p>
                                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                                    <li><strong>Gentlemen:</strong> Conduct yourselves honorably with polite, dignified, and courteous communication.</li>
                                    <li><strong>Ladies & Families:</strong> Engage with modesty, grace, and confidence as virtuous members of our community.</li>
                                    <li>Focus interactions on marriage compatibility, lifestyle, and values.</li>
                                </ul>
                                <div className="text-center pt-2">
                                    <span className="inline-block bg-[#881337] text-white font-bold px-4 py-2 rounded-lg text-xs">
                                        💬 Open Dashboard & Start Chatting
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="bg-[#881337] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#9F1239]"
                            >
                                Close Preview
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
