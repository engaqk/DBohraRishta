"use client";

import React, { useState, useEffect } from "react";
import {
    Bell,
    Send,
    Smartphone,
    ShieldCheck,
    Users,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    ExternalLink,
    Zap,
    Clock,
    Sparkles,
    MessageSquare,
    Volume2,
    Search
} from "lucide-react";
import toast from "react-hot-toast";
import { requestNotificationPermission, playNotificationChime } from "@/lib/firebase/messaging";

interface PushStats {
    totalUsers: number;
    usersWithTokensCount: number;
    totalTokensCount: number;
    verifiedWithTokensCount: number;
    incompleteWithTokensCount: number;
    candidates: Array<{
        id: string;
        name: string;
        email: string;
        itsNumber: string;
        gender: string;
        status: string;
        tokensCount: number;
    }>;
}

interface PushHistoryItem {
    id: string;
    title: string;
    body: string;
    url: string;
    targetType: string;
    totalTokens: number;
    successCount: number;
    failureCount: number;
    createdAt: string;
}

export default function PushNotificationTab() {
    const [stats, setStats] = useState<PushStats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    const [history, setHistory] = useState<PushHistoryItem[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    // Form State
    const [targetType, setTargetType] = useState<"all" | "verified" | "incomplete" | "specific">("all");
    const [selectedCandidateId, setSelectedCandidateId] = useState("");
    const [candidateSearch, setCandidateSearch] = useState("");
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [url, setUrl] = useState("/");
    const [sending, setSending] = useState(false);
    const [testingDevice, setTestingDevice] = useState(false);
    const [pruning, setPruning] = useState(false);
    const [myDeviceToken, setMyDeviceToken] = useState<string>("");

    // Load initial stats & history
    useEffect(() => {
        fetchStats();
        fetchHistory();

        // Check if current browser already has a token in localStorage
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("dbohra_fcm_token");
            if (saved) setMyDeviceToken(saved);
        }
    }, []);

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await fetch("/api/admin/push/stats");
            const data = await res.json();
            if (data.success) {
                setStats(data);
            }
        } catch (err) {
            console.error("Failed to load push stats:", err);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const res = await fetch("/api/admin/push/history");
            const data = await res.json();
            if (data.success && Array.isArray(data.history)) {
                setHistory(data.history);
            }
        } catch (err) {
            console.error("Failed to load push history:", err);
        } finally {
            setLoadingHistory(false);
        }
    };

    // 1-Click: Enable & Register Current Admin Device
    const handleRegisterCurrentDevice = async () => {
        setTestingDevice(true);
        try {
            const result = await requestNotificationPermission("admin-device");
            if (result.success && result.token) {
                setMyDeviceToken(result.token);
                playNotificationChime();
                toast.success("This admin browser is registered to receive push notifications!");
                fetchStats();
            } else {
                toast.error(result.reason || "Failed to register this device for notifications.");
            }
        } catch (err: any) {
            toast.error(err?.message || "Notification permission error");
        } finally {
            setTestingDevice(false);
        }
    };

    // 1-Click: Send Immediate Test to This Admin Browser
    const handleSendTestToMyDevice = async () => {
        let tokenToUse = myDeviceToken;
        if (!tokenToUse && typeof window !== "undefined") {
            tokenToUse = localStorage.getItem("dbohra_fcm_token") || "";
        }

        if (!tokenToUse) {
            // Try to prompt permission first
            const reg = await requestNotificationPermission("admin-device");
            if (reg.success && reg.token) {
                tokenToUse = reg.token;
                setMyDeviceToken(reg.token);
            } else {
                toast.error("Please click 'Register This Device' first to allow notifications.");
                return;
            }
        }

        setTestingDevice(true);
        try {
            const res = await fetch("/api/admin/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType: "test_token",
                    testToken: tokenToUse,
                    title: title || "✨ Test BohraRishta Notification",
                    body: body || "Audio chime & push notification delivery verified successfully!",
                    url: url || "/"
                })
            });
            const data = await res.json();
            if (data.success) {
                playNotificationChime();
                toast.success("Test notification dispatched! Check your notification shade / screen.");
            } else {
                toast.error(data.message || data.error || "Failed to deliver test notification.");
            }
        } catch (err: any) {
            toast.error(err?.message || "Test dispatch failed");
        } finally {
            setTestingDevice(false);
        }
    };

    // Audit and clean stale / unregistered device tokens from database
    const handlePruneInactiveTokens = async () => {
        const confirmed = window.confirm(
            "Run Device Token Health Audit?\n\nThis scans registered tokens across all candidate accounts and automatically removes inactive, unregistered, or expired device tokens without ringing user devices."
        );
        if (!confirmed) return;

        setPruning(true);
        try {
            const res = await fetch("/api/admin/push/prune", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `Audit complete. ${data.activeCount} active devices verified.`);
                fetchStats();
            } else {
                toast.error(data.error || "Failed to audit tokens.");
            }
        } catch (err: any) {
            toast.error(err?.message || "Token audit request failed");
        } finally {
            setPruning(false);
        }
    };

    // Apply Quick Preset Templates
    const applyPreset = (presetTitle: string, presetBody: string, presetUrl: string) => {
        setTitle(presetTitle);
        setBody(presetBody);
        setUrl(presetUrl);
        playNotificationChime();
        toast.success("Template preset loaded!");
    };

    // Send Broadcast
    const handleSendBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !body.trim()) {
            toast.error("Please provide both Title and Message Body.");
            return;
        }

        if (targetType === "specific" && !selectedCandidateId) {
            toast.error("Please select a specific candidate to target.");
            return;
        }

        const audienceLabel =
            targetType === "all"
                ? `ALL ${stats?.usersWithTokensCount || 0} registered members with active devices`
                : targetType === "verified"
                ? `ALL ${stats?.verifiedWithTokensCount || 0} verified candidates`
                : targetType === "incomplete"
                ? `ALL ${stats?.incompleteWithTokensCount || 0} incomplete profile candidates`
                : "the selected candidate";

        const confirmed = window.confirm(
            `CONFIRMATION:\n\nAre you sure you want to dispatch this Real-Time Push Notification to ${audienceLabel}?\n\nTitle: ${title}\nBody: ${body}`
        );
        if (!confirmed) return;

        setSending(true);
        try {
            const res = await fetch("/api/admin/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetType,
                    targetUserId: targetType === "specific" ? selectedCandidateId : undefined,
                    title,
                    body,
                    url,
                })
            });

            const data = await res.json();
            if (data.success) {
                playNotificationChime();
                toast.success(
                    `Push broadcast dispatched! Delivered to ${data.successCount} active device(s)${
                        data.failureCount > 0 ? ` (${data.failureCount} stale tokens auto-pruned)` : ""
                    }.`
                );
                // Clear form & refresh history
                setTitle("");
                setBody("");
                fetchStats();
                fetchHistory();
            } else {
                toast.error(data.error || data.message || "Failed to dispatch push notification.");
            }
        } catch (err: any) {
            console.error("Broadcast error:", err);
            toast.error(err?.message || "Broadcast request failed");
        } finally {
            setSending(false);
        }
    };

    // Filter candidate list for specific target dropdown
    const filteredCandidates = (stats?.candidates || []).filter(c => {
        if (!candidateSearch.trim()) return true;
        const q = candidateSearch.toLowerCase();
        return (
            c.name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.itsNumber.toLowerCase().includes(q)
        );
    });

    return (
        <div className="space-y-6">
            {/* ── TOP STATS & HEALTH STRIP ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Total Devices Active</p>
                        <h3 className="text-2xl font-black text-[#881337] mt-1">
                            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.totalTokensCount || 0}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">FCM Push Device Tokens</p>
                    </div>
                    <div className="w-12 h-12 bg-rose-50 text-[#881337] rounded-2xl flex items-center justify-center">
                        <Smartphone className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Users With Push Enabled</p>
                        <h3 className="text-2xl font-black text-emerald-700 mt-1">
                            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.usersWithTokensCount || 0}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Out of {stats?.totalUsers || 0} total candidates
                        </p>
                    </div>
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Verified Candidates</p>
                        <h3 className="text-2xl font-black text-sky-700 mt-1">
                            {loadingStats ? <Loader2 className="w-5 h-5 animate-spin" /> : stats?.verifiedWithTokensCount || 0}
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Verified & Reachable</p>
                    </div>
                    <div className="w-12 h-12 bg-sky-50 text-sky-700 rounded-2xl flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200/80 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Admin Device Status
                        </span>
                        <button
                            onClick={fetchStats}
                            className="p-1 text-amber-800 hover:text-amber-950 transition-colors"
                            title="Refresh statistics"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="mt-2">
                        <p className="text-[11px] text-amber-950 font-bold mb-2">
                            {myDeviceToken ? "✓ This browser is registered" : "Not yet registered on this browser"}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleRegisterCurrentDevice}
                                disabled={testingDevice}
                                className="bg-[#881337] hover:bg-[#70102d] text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                {testingDevice ? "Registering..." : "Register Device"}
                            </button>
                            <button
                                type="button"
                                onClick={handleSendTestToMyDevice}
                                disabled={testingDevice}
                                className="bg-white hover:bg-amber-100 text-[#881337] border border-amber-300 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                            >
                                <Volume2 className="w-3 h-3 text-[#881337]" />
                                Test Ping
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT GRID: COMPOSER + PREVIEW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── LEFT 2 COLUMNS: COMPOSER FORM ── */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                        <div>
                            <h2 className="text-xl font-bold font-serif text-[#881337] flex items-center gap-2">
                                <Bell className="w-5 h-5 text-[#881337]" />
                                Real-Time Push Notification Dispatcher
                            </h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Instantly rings mobile phones, desktop browsers, and tablets via Firebase Cloud Messaging.
                            </p>
                        </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="mb-6">
                        <p className="text-[11px] font-black uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
                            Quick Templates (Click to fill)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    applyPreset(
                                        "✨ Direct Chat Window is LIVE!",
                                        "All verified candidates can now connect and chat directly! Start your conversation today.",
                                        "/?openChat=true"
                                    )
                                }
                                className="bg-rose-50 hover:bg-rose-100 text-[#881337] border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                                ✨ Open Chat Active
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    applyPreset(
                                        "💍 New Verified Bohra Matches Today",
                                        "Explore newly verified candidate profiles matching your age, education, and city preferences.",
                                        "/"
                                    )
                                }
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                                💍 New Matches Available
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    applyPreset(
                                        "📸 Photo & Selfie Verification Reminder",
                                        "Complete your live selfie verification to unlock full biodatas, photos, and direct chat.",
                                        "/candidate-registration"
                                    )
                                }
                                className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                                📸 Complete Selfie Verification
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    applyPreset(
                                        "💬 You Have a New Direct Message",
                                        "A verified candidate sent you a direct message. Tap to open and reply with Bohra adab.",
                                        "/?tab=chat"
                                    )
                                }
                                className="bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 text-xs font-bold px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                                💬 New Message Waiting
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleSendBroadcast} className="space-y-5">
                        {/* Target Audience Selector */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-2">
                                Target Audience
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setTargetType("all")}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        targetType === "all"
                                            ? "border-[#881337] bg-rose-50/70 text-[#881337] ring-2 ring-[#881337]/20 font-bold"
                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                    }`}
                                >
                                    <div className="text-xs font-black">All Members</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                        {stats?.usersWithTokensCount || 0} active users
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTargetType("verified")}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        targetType === "verified"
                                            ? "border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 font-bold"
                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                    }`}
                                >
                                    <div className="text-xs font-black">Verified Only</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                        {stats?.verifiedWithTokensCount || 0} candidates
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTargetType("incomplete")}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        targetType === "incomplete"
                                            ? "border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20 font-bold"
                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                    }`}
                                >
                                    <div className="text-xs font-black">Incomplete</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                        {stats?.incompleteWithTokensCount || 0} members
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTargetType("specific")}
                                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        targetType === "specific"
                                            ? "border-sky-600 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20 font-bold"
                                            : "border-gray-200 hover:border-gray-300 text-gray-700"
                                    }`}
                                >
                                    <div className="text-xs font-black">Specific User</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">1 candidate</div>
                                </button>
                            </div>
                        </div>

                        {/* Specific Candidate Dropdown (if selected) */}
                        {targetType === "specific" && (
                            <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2">
                                <label className="block text-xs font-black uppercase tracking-wider text-sky-950">
                                    Search & Select Candidate
                                </label>
                                <div className="relative">
                                    <Search className="w-4 h-4 text-sky-600 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder="Filter by name, email, or ITS..."
                                        value={candidateSearch}
                                        onChange={(e) => setCandidateSearch(e.target.value)}
                                        className="w-full bg-white border border-sky-200 rounded-xl pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-sky-500"
                                    />
                                </div>
                                <select
                                    value={selectedCandidateId}
                                    onChange={(e) => setSelectedCandidateId(e.target.value)}
                                    className="w-full bg-white border border-sky-200 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                                >
                                    <option value="">-- Choose Candidate ({filteredCandidates.length} available) --</option>
                                    {filteredCandidates.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} {c.itsNumber ? `(ITS: ${c.itsNumber})` : ""} — {c.email} ({c.tokensCount} device{c.tokensCount > 1 ? "s" : ""})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Title Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
                                    Notification Title
                                </label>
                                <span className="text-[10px] text-gray-400 font-bold">{title.length}/65 chars</span>
                            </div>
                            <input
                                type="text"
                                maxLength={65}
                                placeholder="e.g. ✨ Direct Chat Window is LIVE!"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-[#881337] transition-all"
                                required
                            />
                        </div>

                        {/* Message Body Field */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-xs font-black uppercase tracking-wider text-gray-700">
                                    Notification Message Body
                                </label>
                                <span className="text-[10px] text-gray-400 font-bold">{body.length}/200 chars</span>
                            </div>
                            <textarea
                                maxLength={200}
                                rows={3}
                                placeholder="e.g. All verified candidates can now connect and chat directly with noble Bohra adab. Tap to open and start a conversation."
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-[#881337] transition-all"
                                required
                            />
                        </div>

                        {/* Action Link / Target URL */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-gray-700 mb-1.5">
                                Action Link / Target URL (Opened when tapped)
                            </label>
                            <input
                                type="text"
                                placeholder="/"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-mono outline-none focus:bg-white focus:ring-2 focus:ring-[#881337] transition-all"
                            />
                            <p className="text-[10px] text-gray-400 mt-1">
                                Default is <code className="bg-gray-100 px-1 py-0.5 rounded">/</code> (Dashboard). Use <code className="bg-gray-100 px-1 py-0.5 rounded">/?openChat=true</code> for Chat or <code className="bg-gray-100 px-1 py-0.5 rounded">/candidate-registration</code> for Verification.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                            <button
                                type="submit"
                                disabled={sending || !title.trim() || !body.trim()}
                                className="w-full sm:flex-1 bg-gradient-to-r from-[#881337] to-[#9F1239] hover:from-[#70102d] hover:to-[#881337] text-white font-black py-4 px-6 rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                {sending ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Dispatching Real-Time Push...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-5 h-5" />
                                        <span>Dispatch Push Notification Blast</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={handleSendTestToMyDevice}
                                disabled={testingDevice || sending}
                                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-4 px-5 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-gray-200"
                                title="Send test ping to this browser"
                            >
                                <Volume2 className="w-4 h-4 text-[#881337]" />
                                <span>Test Ping</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── RIGHT COLUMN: REALISTIC DEVICE PREVIEW ── */}
                <div className="space-y-4">
                    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                            <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                <Smartphone className="w-4 h-4 text-[#881337]" />
                                Live Device Preview
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-rose-100 text-[#881337] px-2 py-0.5 rounded-full">
                                Mobile Screen
                            </span>
                        </div>

                        {/* Phone Frame Mockup */}
                        <div className="w-full max-w-[320px] mx-auto bg-gradient-to-b from-gray-900 via-gray-800 to-black rounded-[2.5rem] p-3 shadow-2xl border-4 border-gray-700">
                            {/* Phone Speaker & Camera Notch */}
                            <div className="w-24 h-4 bg-black rounded-full mx-auto mb-3 flex items-center justify-center">
                                <div className="w-2.5 h-2.5 rounded-full bg-gray-800" />
                            </div>

                            {/* Lock Screen Wallpaper Area */}
                            <div className="bg-gradient-to-br from-[#881337]/90 via-[#4c0519] to-black rounded-[2rem] p-4 text-white min-h-[360px] flex flex-col justify-between relative overflow-hidden">
                                {/* Clock */}
                                <div className="text-center pt-2">
                                    <div className="text-4xl font-light tracking-tight font-sans">
                                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                    <p className="text-[11px] text-rose-200/80 font-medium mt-0.5">
                                        {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                                    </p>
                                </div>

                                {/* Floating Push Notification Card */}
                                <div className="my-auto bg-white/95 backdrop-blur-md text-gray-900 rounded-2xl p-3 shadow-2xl border border-white/40 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-4 h-4 rounded-md bg-[#881337] text-white flex items-center justify-center font-bold text-[8px] font-serif shadow-xs">
                                                53
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-[#881337]">
                                                53DBohraRishta
                                            </span>
                                        </div>
                                        <span className="text-[9px] text-gray-400 font-medium">Now</span>
                                    </div>
                                    <h4 className="text-xs font-black text-gray-900 leading-snug line-clamp-1">
                                        {title.trim() || "✨ Direct Chat Window is LIVE!"}
                                    </h4>
                                    <p className="text-[11px] text-gray-600 leading-snug mt-0.5 line-clamp-2">
                                        {body.trim() || "All verified candidates can now connect and chat directly! Start your conversation today."}
                                    </p>
                                    <div className="mt-2 pt-1.5 border-t border-gray-100 flex items-center justify-between text-[9px] font-bold text-[#881337]">
                                        <span>Tap to Open</span>
                                        <ExternalLink className="w-2.5 h-2.5" />
                                    </div>
                                </div>

                                {/* Bottom Home Bar */}
                                <div className="w-24 h-1 bg-white/40 rounded-full mx-auto mb-1" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-4 text-xs text-gray-700 space-y-2">
                        <p className="font-bold text-[#881337] flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-[#881337]" />
                            Cross-Platform Push Guarantee
                        </p>
                        <p className="text-[11px] text-gray-600 leading-relaxed">
                            Notifications are pushed simultaneously through <strong>FCM high-priority pipelines</strong> with system audio alerts. Delivered to Android native APK, installed home screen apps, and desktop browsers.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── BROADCAST HISTORY TABLE ── */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#881337]" />
                        <h3 className="font-bold font-serif text-lg text-gray-900">Push Notification Broadcast History</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePruneInactiveTokens}
                            disabled={pruning}
                            className="text-xs bg-rose-50 hover:bg-rose-100 text-[#881337] border border-rose-200 font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Audits all device tokens and cleans inactive, unregistered, or expired subscriptions"
                        >
                            {pruning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-[#D4AF37]" />}
                            <span>{pruning ? "Auditing Tokens..." : "Clean Inactive Tokens"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={fetchHistory}
                            className="text-xs text-[#881337] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <RefreshCw className="w-3 h-3" /> Refresh Log
                        </button>
                    </div>
                </div>

                {loadingHistory ? (
                    <div className="py-8 text-center text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#881337]" />
                        <p className="text-xs">Loading broadcast logs...</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs">
                        No push broadcasts sent yet. Use the composer above to dispatch your first push notification!
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-gray-400">
                                    <th className="py-2.5 px-3">Date & Time</th>
                                    <th className="py-2.5 px-3">Notification Title</th>
                                    <th className="py-2.5 px-3">Message Body</th>
                                    <th className="py-2.5 px-3">Audience</th>
                                    <th className="py-2.5 px-3 text-right">Delivered</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {history.map((item) => (
                                    <tr key={item.id} className="hover:bg-rose-50/40 transition-colors">
                                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap font-mono text-[11px]">
                                            {new Date(item.createdAt).toLocaleString([], {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </td>
                                        <td className="py-3 px-3 font-bold text-gray-900 max-w-[200px] truncate">
                                            {item.title}
                                        </td>
                                        <td className="py-3 px-3 text-gray-600 max-w-[320px] truncate">
                                            {item.body}
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold uppercase text-[9px]">
                                                {item.targetType}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-black">
                                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                ✓ {item.successCount || 0}
                                            </span>
                                            {item.failureCount > 0 && (
                                                <span
                                                    className="ml-1 text-gray-500 text-[10px] font-medium"
                                                    title="Expired or unregistered browser sessions (now automatically pruned)"
                                                >
                                                    ({item.failureCount} stale/pruned)
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Stale Token Explanation & Health Strip */}
                <div className="mt-5 p-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#881337] shrink-0" />
                        <span>
                            <strong className="text-gray-900">Device Token Auto-Pruning Active:</strong> When candidates log out, clear cookies, or change phones, FCM marks their old session as unregistered. The system automatically purges these dead tokens on every broadcast so they never accumulate.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
