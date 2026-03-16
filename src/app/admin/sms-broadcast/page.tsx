"use client";

import React, { useState, useEffect, useCallback } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import {
    Send, Loader2, ArrowLeft, Smartphone, CheckCircle2, History,
    MessageSquare, AlertCircle, RefreshCw, User, Database, ShieldCheck, Search,
    Zap, XCircle, Clock, Activity
} from "lucide-react";
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
    sentAt?: string;
    recipients?: string[];
    deliveredNumbers?: string[];
    failedNumbers?: string[];
}

interface SmsLog {
    id: string;
    receiver: string;
    status: string;
    event: string;
    errorCode?: number;
    errorMessage?: string;
    receivedAt: string;
    sentAt?: string;
    deliveredAt?: string;
}

interface PhoneEntry {
    phone: string;
    name?: string;
    source: 'firestore' | 'auth' | 'both';
}

export default function AdminSmsBroadcastPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [history, setHistory] = useState<SmsBroadcastHistory[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'history' | 'logs'>('history');
    const [mainTab, setMainTab] = useState<'send' | 'getById' | 'getBatch'>('send');

    const [smsIdInput, setSmsIdInput] = useState("");
    const [batchIdInput, setBatchIdInput] = useState("");
    const [lookupResult, setLookupResult] = useState<any>(null);
    const [lookupLoading, setLookupLoading] = useState(false);

    const [numbers, setNumbers] = useState<PhoneEntry[]>([]);
    const [numbersLoading, setNumbersLoading] = useState(true);
    const [numberSearch, setNumberSearch] = useState("");
    const [lastSentResult, setLastSentResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

    const MAX_SMS_LENGTH = 160;
    const charCount = message.length;
    const smsCount = Math.ceil(charCount / MAX_SMS_LENGTH) || 1;

    // Fetch registered mobile numbers from both Firestore + Firebase Auth
    const fetchNumbers = useCallback(async () => {
        setNumbersLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/sms-numbers', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.success) {
                setNumbers(data.numbers);
            } else {
                toast.error("Failed to load numbers: " + (data.error || "Unknown error"));
            }
        } catch (e) {
            toast.error("Could not fetch mobile numbers.");
        } finally {
            setNumbersLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/sms-broadcast/history', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.history) {
                setHistory(data.history);
            }
        } catch (e) {
            console.error("Failed to fetch SMS history:", e);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const fetchSmsLogs = useCallback(async () => {
        setLogsLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/sms-logs', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.logs) {
                setSmsLogs(data.logs);
            }
        } catch (e) {
            console.warn("SMS logs not available:", e);
            setSmsLogs([]);
        } finally {
            setLogsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNumbers();
        fetchHistory();
        fetchSmsLogs();

        // Auto-refresh history and logs every 30 seconds
        const interval = setInterval(() => {
            fetchHistory();
            fetchSmsLogs();
        }, 30000);

        return () => clearInterval(interval);
    }, [fetchNumbers, fetchHistory, fetchSmsLogs]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!message.trim()) {
            toast.error("Please enter a message before sending.");
            return;
        }

        const confirmed = window.confirm(
            `Send this SMS to ALL ${numbers.length} registered mobile numbers?\n\nMessage:\n"${message.trim()}"\n\nThis cannot be undone.`
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

            setLastSentResult({ sent: data.sent, failed: data.failed, total: data.totalFound });
            toast.success(`✅ SMS sent to ${data.sent} numbers!${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
            setMessage("");
            fetchHistory();
        } catch (error: any) {
            toast.error("SMS Broadcast failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    const handleLookupSms = async (id: string, type: 'sms' | 'batch') => {
        if (!id.trim()) return;
        setLookupLoading(true);
        setLookupResult(null);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const url = type === 'sms' ? `/api/admin/sms-check/${id}` : `/api/admin/sms-batch/${id}`;
            const res = await fetch(url, {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setLookupResult(data.data || data);
            toast.success("Status retrieved");
        } catch (error: any) {
            toast.error("Lookup failed: " + error.message);
        } finally {
            setLookupLoading(false);
        }
    };

    // Filtered numbers based on search
    const filteredNumbers = numbers.filter(n =>
        !numberSearch ||
        n.phone.includes(numberSearch) ||
        (n.name && n.name.toLowerCase().includes(numberSearch.toLowerCase()))
    );

    const sourceLabel = (source: PhoneEntry['source']) => {
        if (source === 'both') return { label: 'Firestore + Auth', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
        if (source === 'auth') return { label: 'Auth Only', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
        return { label: 'Firestore', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-5xl w-full mx-auto">

                {/* Back */}
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#881337] font-bold mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </button>

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#881337] to-rose-800 rounded-2xl flex items-center justify-center shadow-lg">
                        <Smartphone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif">SMS Gateway</h1>
                        <p className="text-gray-500 text-sm">Manage SMS broadcasts and track delivery status via Textbee.</p>
                    </div>
                </div>

                {/* Main Tabs */}
                <div className="flex border-b border-gray-200 mb-8 overflow-x-auto whitespace-nowrap scrollbar-hide">
                    {[
                        { id: 'send', label: 'Send SMS', icon: <Send className="w-4 h-4" /> },
                        { id: 'getById', label: 'Get SMS by ID', icon: <Search className="w-4 h-4" /> },
                        { id: 'getBatch', label: 'Get SMS Batch', icon: <History className="w-4 h-4" /> },
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => { setMainTab(t.id as any); setLookupResult(null); }}
                            className={`px-6 py-4 text-sm font-black uppercase tracking-widest flex items-center gap-2 transition-all relative ${
                                mainTab === t.id ? 'text-[#881337]' : 'text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            {t.icon} {t.label}
                            {mainTab === t.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#881337] rounded-full" />}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* ── Left: Compose + Stats ── */}
                    <div className="lg:col-span-2 space-y-6">

                        {mainTab === 'send' && (
                            <>
                                {/* Success result banner */}
                                {lastSentResult && (
                                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                        <div className="text-sm text-emerald-800">
                                            <p className="font-bold">Broadcast sent successfully!</p>
                                            <p>✅ {lastSentResult.sent} delivered · {lastSentResult.failed > 0 ? `⚠ ${lastSentResult.failed} failed · ` : ''}📱 {lastSentResult.total} total numbers</p>
                                        </div>
                                        <button onClick={() => setLastSentResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700 text-xs font-bold">✕</button>
                                    </div>
                                )}

                                {/* Compose Form */}
                                <form onSubmit={handleSend} className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">

                                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-xs text-amber-800 leading-relaxed">
                                            <p className="font-bold mb-0.5">Bulk Broadcast</p>
                                            <p>Send to all {numbersLoading ? '...' : numbers.length} recipients. Textbee handles batches automatically. Standard SIM rates apply.</p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Message Body</label>
                                        <textarea
                                            rows={6}
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            placeholder="e.g. Eid Mubarak from 53DBohraRishta! 🌙 Wishing all members a blessed Eid."
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none resize-none transition-all text-sm leading-relaxed"
                                            required
                                        />
                                        <div className="flex justify-between items-center mt-2">
                                            <p className="text-xs text-gray-400">
                                                {smsCount > 1
                                                    ? <span className="text-orange-500 font-bold">⚠ Will send as {smsCount} SMS parts</span>
                                                    : <span>Keep under 160 chars to avoid splitting</span>}
                                            </p>
                                            <p className={`text-xs font-bold tabular-nums ${charCount > MAX_SMS_LENGTH ? 'text-orange-500' : 'text-gray-400'}`}>
                                                {charCount}/{MAX_SMS_LENGTH}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        id="sms-broadcast-send-btn"
                                        disabled={loading || !message.trim() || numbersLoading}
                                        className="w-full bg-[#881337] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#70102d] transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading
                                            ? <><Loader2 className="w-5 h-5 animate-spin" /> Sending SMS Broadcast...</>
                                            : <><Send className="w-5 h-5" /> Send to All {numbers.length} Numbers</>}
                                    </button>
                                </form>
                            </>
                        )}

                        {mainTab === 'getById' && (
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <Search className="w-5 h-5 text-indigo-500" /> Lookup SMS Status
                                </h2>
                                <p className="text-sm text-gray-500">Enter a specific Message ID to check its current delivery status on the device.</p>
                                
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Enter SMS ID (e.g. sms_12345...)"
                                        value={smsIdInput}
                                        onChange={e => setSmsIdInput(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                    <button
                                        onClick={() => handleLookupSms(smsIdInput, 'sms')}
                                        disabled={lookupLoading || !smsIdInput.trim()}
                                        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                                    >
                                        {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Check SMS Status
                                    </button>
                                </div>

                                {lookupResult && (
                                    <div className="mt-6 bg-gray-50 rounded-2xl p-5 border border-gray-200 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Status Details</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                lookupResult.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' : 
                                                lookupResult.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {lookupResult.status}
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <p><span className="text-gray-400 font-bold">Recipient:</span> {lookupResult.recipient || lookupResult.recipients?.[0]}</p>
                                            <p><span className="text-gray-400 font-bold">Message:</span> {lookupResult.message}</p>
                                            <p><span className="text-gray-400 font-bold">Sent at:</span> {lookupResult.sentAt || lookupResult.createdAt}</p>
                                            {lookupResult.deliveredAt && <p><span className="text-gray-400 font-bold">Delivered at:</span> {lookupResult.deliveredAt}</p>}
                                            {lookupResult.errorMessage && <p className="text-rose-600"><span className="text-gray-400 font-bold">Error:</span> {lookupResult.errorMessage}</p>}
                                        </div>
                                        <pre className="mt-4 p-3 bg-gray-900 text-gray-300 rounded-lg text-[10px] overflow-x-auto">
                                            {JSON.stringify(lookupResult, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {mainTab === 'getBatch' && (
                            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
                                <h2 className="text-xl font-black flex items-center gap-2">
                                    <History className="w-5 h-5 text-emerald-500" /> Check Batch Status
                                </h2>
                                <p className="text-sm text-gray-500">Check the progress of a bulk broadcast batch.</p>
                                
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Enter Batch ID (e.g. batch_98765...)"
                                        value={batchIdInput}
                                        onChange={e => setBatchIdInput(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                                    />
                                    <button
                                        onClick={() => handleLookupSms(batchIdInput, 'batch')}
                                        disabled={lookupLoading || !batchIdInput.trim()}
                                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-50"
                                    >
                                        {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                        Lookup Batch
                                    </button>
                                </div>

                                {lookupResult && (
                                    <div className="mt-6 bg-gray-50 rounded-2xl p-5 border border-gray-200 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black uppercase text-gray-400">Batch Progress</span>
                                            <div className="flex gap-2">
                                                <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                    {lookupResult.messages?.filter((m: any) => m.status === 'DELIVERED').length || 0} Delivered
                                                </span>
                                                <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                    {lookupResult.messages?.filter((m: any) => m.status === 'FAILED').length || 0} Failed
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-xs max-h-60 overflow-y-auto">
                                            {lookupResult.messages?.map((m: any, idx: number) => (
                                                <div key={idx} className="flex justify-between border-b pb-1">
                                                    <span className="font-mono">{m.recipient}</span>
                                                    <span className={m.status === 'DELIVERED' ? 'text-emerald-600 font-bold' : 'text-amber-600'}>{m.status}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <pre className="mt-4 p-3 bg-gray-900 text-gray-300 rounded-lg text-[10px] overflow-x-auto">
                                            {JSON.stringify(lookupResult, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Mobile Numbers List ── */}
                        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h2 className="font-bold text-[#881337] flex items-center gap-2 text-lg">
                                            <Smartphone className="w-5 h-5" />
                                            Registered Mobile Numbers
                                            {!numbersLoading && (
                                                <span className="bg-[#881337] text-white text-xs font-bold px-2 py-0.5 rounded-full">{numbers.length}</span>
                                            )}
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-0.5">Combined from Firestore users + Firebase Auth accounts</p>
                                    </div>
                                    <button
                                        onClick={fetchNumbers}
                                        disabled={numbersLoading}
                                        className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#881337] bg-gray-50 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 px-3 py-2 rounded-xl transition-all"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${numbersLoading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>
                                </div>

                                {/* Source Legend */}
                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1">Sources:</span>
                                    <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        <Database className="w-2.5 h-2.5" /> Firestore
                                    </span>
                                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="w-2.5 h-2.5" /> Auth Only
                                    </span>
                                    <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> Firestore + Auth
                                    </span>
                                </div>

                                {/* Search */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or number..."
                                        value={numberSearch}
                                        onChange={e => setNumberSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#881337] outline-none"
                                    />
                                </div>
                            </div>

                            {/* Numbers Table */}
                            {numbersLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-[#881337]" />
                                    <span className="ml-3 text-sm text-gray-500 font-medium">Fetching from Firestore & Auth...</span>
                                </div>
                            ) : filteredNumbers.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-sm italic">
                                    {numberSearch ? `No results for "${numberSearch}"` : 'No registered mobile numbers found.'}
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
                                    {filteredNumbers.map((entry, idx) => {
                                        const { label, cls } = sourceLabel(entry.source);
                                        return (
                                            <div key={entry.phone} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50/60 transition-colors">
                                                <span className="text-xs text-gray-300 font-mono w-6 shrink-0 text-right">{idx + 1}</span>
                                                <div className="w-8 h-8 rounded-full bg-rose-50 text-[#881337] flex items-center justify-center shrink-0 border border-rose-100 text-xs font-bold">
                                                    {entry.name ? entry.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {entry.name && (
                                                        <p className="text-sm font-bold text-gray-800 truncate">{entry.name}</p>
                                                    )}
                                                    <p className="text-xs font-mono text-gray-500 tabular-nums">{entry.phone}</p>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${cls}`}>{label}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {filteredNumbers.length > 0 && (
                                <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 text-xs text-gray-400 font-medium">
                                    Showing {filteredNumbers.length} of {numbers.length} numbers
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right Sidebar ── */}
                    <div className="space-y-6">

                        {/* Textbee Info */}
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

                        {/* History / Logs Tabs */}
                        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                            {/* Tab bar */}
                            <div className="flex border-b border-gray-100">
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                        activeTab === 'history' ? 'text-[#881337] border-b-2 border-[#881337] bg-rose-50/50' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    <History className="w-3.5 h-3.5" /> Broadcasts
                                </button>
                                <button
                                    onClick={() => { setActiveTab('logs'); fetchSmsLogs(); }}
                                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                                        activeTab === 'logs' ? 'text-[#881337] border-b-2 border-[#881337] bg-rose-50/50' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                                >
                                    <Activity className="w-3.5 h-3.5" /> Live Delivery
                                    {smsLogs.length > 0 && <span className="bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{smsLogs.length}</span>}
                                </button>
                            </div>

                            <div className="p-5">
                                {activeTab === 'history' ? (
                                    historyLoading ? (
                                        <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300" /></div>
                                    ) : history.length === 0 ? (
                                        <p className="text-xs text-center text-gray-400 py-8 italic">No SMS broadcasts sent yet.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {history.map(item => {
                                                const delivered = item.deliveredNumbers?.length ?? 0;
                                                const failed = item.failedNumbers?.length ?? item.failed ?? 0;
                                                const total = item.sent ?? item.totalFound ?? 0;
                                                const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : null;
                                                return (
                                                    <div key={item.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                                <p className="text-[10px] font-bold text-emerald-700">
                                                                    {total} sent
                                                                    {failed > 0 && <span className="text-orange-500 ml-1">· {failed} failed</span>}
                                                                </p>
                                                            </div>
                                                            <p className="text-[9px] text-gray-400 tabular-nums">
                                                                {item.createdAt?.toDate?.()?.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                        {/* Webhook delivery stats */}
                                                        {delivered > 0 && (
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                                        style={{ width: `${deliveryRate}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-emerald-600 tabular-nums">{deliveryRate}% delivered</span>
                                                            </div>
                                                        )}
                                                        {delivered > 0 && (
                                                            <div className="flex gap-2 mb-2">
                                                                <span className="flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded-full font-bold">
                                                                    <CheckCircle2 className="w-2 h-2" /> {delivered} delivered
                                                                </span>
                                                                {failed > 0 && (
                                                                    <span className="flex items-center gap-1 text-[9px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full font-bold">
                                                                        <XCircle className="w-2 h-2" /> {failed} failed
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{item.message}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    /* Live Delivery Logs from webhook */
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5 text-amber-500" />
                                                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Real-time via Textbee Webhook</p>
                                            </div>
                                            <button onClick={fetchSmsLogs} className="text-[10px] text-gray-400 hover:text-[#881337] flex items-center gap-1 font-bold">
                                                <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} /> Refresh
                                            </button>
                                        </div>
                                        {logsLoading ? (
                                            <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-300" /></div>
                                        ) : smsLogs.length === 0 ? (
                                            <div className="text-center py-8">
                                                <Activity className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-xs text-gray-400 italic">No delivery events yet.</p>
                                                <p className="text-[10px] text-gray-300 mt-1">Events appear here after SMS is sent.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                                {smsLogs.map(log => (
                                                    <div key={log.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                        {log.status === 'DELIVERED' ? (
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        ) : log.status === 'FAILED' ? (
                                                            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                        ) : (
                                                            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-gray-800 font-mono">{log.receiver || '—'}</p>
                                                            <p className="text-[10px] text-gray-400">
                                                                {log.status}
                                                                {log.errorCode ? ` · Error ${log.errorCode}` : ''}
                                                                {log.errorMessage ? `: ${log.errorMessage}` : ''}
                                                            </p>
                                                        </div>
                                                        <p className="text-[9px] text-gray-300 tabular-nums shrink-0">
                                                            {log.receivedAt ? new Date(log.receivedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
                            <h3 className="text-xs font-black uppercase text-amber-800 mb-2">💡 Pro Tips</h3>
                            <ul className="text-xs text-amber-700 leading-relaxed space-y-1.5 list-disc list-inside">
                                <li>Keep under 160 chars per SMS to avoid splitting costs.</li>
                                <li>Use SMS only for urgent or festival announcements.</li>
                                <li>Standard SIM rates apply per message sent.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
