"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, orderBy, addDoc, serverTimestamp, onSnapshot, collectionGroup } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Users, Search, ArrowLeft, ShieldCheck, Clock, XCircle, CheckCircle, Archive, Mail, Phone, User, Calendar, MapPin, RefreshCw, Send, MessageCircle, ShieldAlert, Database, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface RegistrationUser {
    uid: string;
    email?: string;
    name?: string;
    mobile?: string;
    mobileCode?: string;
    gender?: string;
    dob?: string;
    city?: string;
    state?: string;
    country?: string;
    jamaat?: string;
    ejamaatId?: string;
    itsNumber?: string;
    status?: string;
    isItsVerified?: boolean;
    isCandidateFormComplete?: boolean;
    libasImageUrl?: string | null;
    createdAt?: any;
    [key: string]: any;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending_verification: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" /> },
    verified: { label: 'Verified', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <ShieldCheck className="w-3 h-3" /> },
    approved: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle className="w-3 h-3" /> },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" /> },
    hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Clock className="w-3 h-3" /> },
    archived: { label: 'Archived', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: <Archive className="w-3 h-3" /> },
};

export default function AdminUsersPage() {
    const { user, impersonateUser } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<RegistrationUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterComplete, setFilterComplete] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<RegistrationUser | null>(null);
    const [authUsers, setAuthUsers] = useState<any[]>([]);
    const [showAuthList, setShowAuthList] = useState(false);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastMsg, setBroadcastMsg] = useState('');
    const [sendingBroadcast, setSendingBroadcast] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof RegistrationUser; direction: 'asc' | 'desc' }>(
        { key: 'createdAt', direction: 'desc' }
    );
    const [msgCounts, setMsgCounts] = useState<Record<string, { total: number, userMsgs: number }>>({});
    const [activeMainTab, setActiveMainTab] = useState<'firestore' | 'auth'>('firestore');
    const [filterGender, setFilterGender] = useState<string>('male');
    const [isSyncing, setIsSyncing] = useState(false);


    // Admin auth guard
    useEffect(() => {
        const token = localStorage.getItem('admin_auth_token');
        if (!token) { router.push('/admin/login'); return; }
    }, [router]);

    const fetchDashboardData = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/dashboard-data', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            
            if (data.users) {
                setUsers(data.users);
            }
            if (data.msgCounts) {
                setMsgCounts(data.msgCounts);
            }
            if (data.error) {
                console.error('API Error:', data.error);
                // If unauthorized, don't toast yet here to avoid double toasts
            }
        } catch (e) {
            console.error('Failed to fetch dashboard data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
        
        // Refresh every 30 seconds for "pseudo-realtime" since we removed onSnapshot
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    // Fetch auth users on load to show count in tab
    useEffect(() => {
        const token = localStorage.getItem('admin_auth_token');
        if (token) {
            fetchAuthUsers();
        }
    }, []);

    const fetchUsers = async () => {
        await fetchDashboardData();
    };

    const handleSendBroadcast = async () => {
        if (!broadcastMsg.trim()) return;
        setSendingBroadcast(true);
        try {
            await addDoc(collection(db, 'broadcasts'), {
                message: broadcastMsg,
                adminId: user?.uid,
                createdAt: serverTimestamp()
            });
            await addDoc(collection(db, 'admin_audit_logs'), {
                adminId: user?.uid,
                action: 'broadcast_message',
                message: broadcastMsg,
                timestamp: serverTimestamp()
            });
            toast.success('Broadcast message sent!');
            setBroadcastMsg('');
            setShowBroadcastModal(false);
        } catch (e: any) {
            toast.error('Failed: ' + e.message);
        } finally {
            setSendingBroadcast(false);
        }
    };

    const fetchAuthUsers = async () => {
        setLoadingAuth(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/auth-users', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.users) {
                setAuthUsers(data.users);
            } else if (data.error) {
                toast.error(data.error);
            }
        } catch (e: any) {
            toast.error('Failed to fetch auth users');
        } finally {
            setLoadingAuth(false);
        }
    };

    const markMessagesAsRead = async (userId: string) => {
        try {
            const { collection, getDocs, query, where, writeBatch } = await import('firebase/firestore');
            const threadRef = collection(db, "admin_messages", userId, "thread");
            // Fetch all user messages in this thread
            const q = query(threadRef, where("from", "==", "user"));
            const snap = await getDocs(q);

            if (snap.empty) return;

            // Filter docs not already marked as read
            const unreadDocs = snap.docs.filter(d => d.data().readByAdmin !== true);
            if (unreadDocs.length === 0) return;

            const batch = writeBatch(db);
            unreadDocs.forEach(d => {
                batch.update(d.ref, { readByAdmin: true });
            });
            await batch.commit();

            // Proactively update local state to clear the badge
            setMsgCounts(prev => {
                if (!prev[userId]) return prev;
                return { ...prev, [userId]: { ...prev[userId], userMsgs: 0 } };
            });
        } catch (e) {
            console.error("Failed to mark messages as read", e);
        }
    };

    const handleSyncAuth = async () => {
        const confirmed = window.confirm("This will find users who exist in Firebase Auth but have no record in the Database, and create skeleton records for them so they can receive SMS broadcasts.\n\nProceed?");
        if (!confirmed) return;

        setIsSyncing(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/users/sync-auth', {
                method: 'POST',
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Successfully synced ${data.syncedCount} users!`);
                fetchAuthUsers(); // Refresh counts
            } else {
                toast.error(data.error || "Sync failed");
            }
        } catch (e) {
            toast.error("Network error during sync");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleDeleteUser = async (userId: string, name: string) => {
        const confirmed = window.confirm(`DANGER: Are you absolutely sure you want to PERMANENTLY delete the account and biodata for ${name || 'this user'}? \n\nThis will delete their profile from the Database AND their login account from Firebase Auth. This action CANNOT be undone.`);
        if (!confirmed) return;

        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 
                    'Authorization': token || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, adminId: user?.uid })
            });
            const data = await res.json();
            
            if (data.success) {
                toast.success('User account and profile deleted completely');
                setUsers(prev => prev.filter(u => u.uid !== userId));
                setAuthUsers(prev => prev.filter(u => u.uid !== userId));
                if (selectedUser?.uid === userId) setSelectedUser(null);
            } else {
                toast.error(data.error || 'Failed to delete user');
            }
        } catch (e: any) {
            toast.error('Network error during deletion');
        }
    };

    useEffect(() => {
        if (activeMainTab === 'auth' && authUsers.length === 0) {
            fetchAuthUsers();
        }
    }, [activeMainTab]);

    // Auto-mark as read when a user is selected/expanded
    useEffect(() => {
        if (selectedUser?.uid) {
            const hasNewMsg = msgCounts[selectedUser.uid]?.userMsgs > 0;
            if (hasNewMsg) {
                markMessagesAsRead(selectedUser.uid);
            }
        }
    }, [selectedUser?.uid]);



    const filteredAndSorted = useMemo(() => {
        const filtered = users.filter(u => {
            const matchSearch = !search ||
                u.name?.toLowerCase().includes(search.toLowerCase()) ||
                u.email?.toLowerCase().includes(search.toLowerCase()) ||
                u.ejamaatId?.includes(search) ||
                u.itsNumber?.includes(search) ||
                u.mobile?.includes(search) ||
                u.city?.toLowerCase().includes(search.toLowerCase()) ||
                u.jamaat?.toLowerCase().includes(search.toLowerCase());

            const matchGender = u.gender?.toLowerCase() === filterGender;
            const matchStatus = filterStatus === 'all' || u.status === filterStatus;
            const matchComplete = filterComplete === 'all' ||
                (filterComplete === 'complete' && u.isCandidateFormComplete) ||
                (filterComplete === 'submitted' && u.isCandidateFormComplete && u.status === 'pending_verification') ||
                (filterComplete === 'incomplete' && !u.isCandidateFormComplete);

            return matchSearch && matchGender && matchStatus && matchComplete;
        });

        return [...filtered].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'createdAt') {
                valA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
                valB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
            }

            if (!valA) return 1;
            if (!valB) return -1;

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, search, filterStatus, filterComplete, sortConfig]);

    const stats = useMemo(() => ({
        total: users.length,
        complete: users.filter(u => u.isCandidateFormComplete).length,
        onboardingSubmitted: users.filter(u => u.isCandidateFormComplete && u.status === 'pending_verification').length,
        onboardingPending: users.filter(u => !u.isCandidateFormComplete).length,
        verified: users.filter(u => u.status === 'verified' || u.status === 'approved').length,
        archived: users.filter(u => u.status === 'archived').length,
        filtered: filteredAndSorted.length
    }), [users, filteredAndSorted]);

    const age = (dob?: string) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#881337]">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#881337] to-[#9F1239] px-6 py-5 shadow-lg">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/admin/approvals')}
                            className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className="text-white font-black text-xl flex items-center gap-2">
                                <Users className="w-5 h-5" /> Registered Users
                            </h1>
                            <p className="text-white/60 text-xs mt-0.5">All Firebase-registered candidate accounts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowBroadcastModal(true)}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-sm font-bold transition-all shadow-lg">
                            <Send className="w-4 h-4" /> Broadcast
                        </button>
                        <button onClick={fetchUsers}
                            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Data
                        </button>
                    </div>
                </div>
            </div>

            {/* Sub-tabs for Section */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-6 flex items-center gap-8">
                    <button
                        onClick={() => setActiveMainTab('firestore')}
                        className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeMainTab === 'firestore' ? 'text-[#881337]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        Registered Candidates ({stats.total})
                        {activeMainTab === 'firestore' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#881337] rounded-full" />}
                    </button>
                    <button
                        onClick={() => setActiveMainTab('auth')}
                        className={`py-4 text-xs font-black uppercase tracking-widest transition-all relative ${activeMainTab === 'auth' ? 'text-[#881337]' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <span className="flex items-center gap-2">
                            Firebase Auth Directory
                            {authUsers.length > 0 && <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{authUsers.length}</span>}
                        </span>
                        {activeMainTab === 'auth' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#881337] rounded-full" />}
                    </button>
                </div>
            </div>

            {/* Gender Sub-tabs for Registered Candidates */}
            {activeMainTab === 'firestore' && (
                <div className="bg-white border-b border-gray-100">
                    <div className="max-w-7xl mx-auto px-6 flex items-center gap-6">
                        {(['male', 'female'] as const).map(g => (
                            <button
                                key={g}
                                onClick={() => setFilterGender(g)}
                                className={`py-3 text-[10px] font-black uppercase tracking-widest transition-all relative ${filterGender === g ? 'text-[#881337]' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                {g}s ({users.filter(u => u.gender?.toLowerCase() === g).length})
                                {filterGender === g && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#881337] rounded-full" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                    {[
                        { label: 'Total Registrations', value: stats.total, color: 'text-gray-900', bg: 'bg-white border-gray-200', filter: 'all' },
                        { label: 'Wait Approval', value: stats.onboardingSubmitted, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', filter: 'submitted' },
                        { label: 'Pending Onboarding', value: stats.onboardingPending, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100', filter: 'incomplete' },
                        { label: 'Form Complete', value: stats.complete, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', filter: 'complete' },
                        { label: 'Verified/Approved', value: stats.verified, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', status: 'verified' },
                        { label: 'Archived', value: stats.archived, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-100', status: 'archived' },
                    ].map(s => (
                        <div key={s.label} 
                            onClick={() => {
                                if (s.filter) {
                                    setFilterComplete(s.filter);
                                    setFilterStatus('all');
                                } else if (s.status) {
                                    setFilterStatus(s.status);
                                    setFilterComplete('all');
                                }
                            }}
                            className={`${s.bg} border rounded-2xl p-4 text-center shadow-sm cursor-pointer hover:ring-2 hover:ring-[#881337]/10 transition-all ${(filterComplete === s.filter && s.filter !== 'all') || (filterStatus === s.status && s.status !== 'all') ? 'ring-2 ring-[#881337]/30 border-[#881337]/30 shadow-md scale-105' : ''}`}>
                            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                            <p className="text-[9px] font-black text-gray-500 mt-1 uppercase tracking-tight">{s.label}</p>
                        </div>
                    ))}
                </div>


                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5 flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, ITS, mobile, city..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#881337]/20 focus:border-[#881337]"
                        />
                    </div>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#881337]/20 font-bold text-gray-700 cursor-pointer">
                        <option value="all">All Statuses</option>
                        <option value="pending_verification">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="hold">On Hold</option>
                        <option value="archived">Archived</option>
                    </select>
                    <select value={filterComplete} onChange={e => setFilterComplete(e.target.value)}
                        className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#881337]/20 font-bold text-gray-700 cursor-pointer">
                        <option value="all">Form: All</option>
                        <option value="complete">Onboarding Done</option>
                        <option value="incomplete">Onboarding Pending</option>
                        <option value="submitted">Waiting Approval</option>
                    </select>
                    {activeMainTab === 'auth' && (
                        <button
                            onClick={handleSyncAuth}
                            disabled={isSyncing || loadingAuth}
                            className="bg-[#881337] text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#70102d] transition-all shadow-md disabled:opacity-50"
                        >
                            {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                            Sync Auth to DB
                        </button>
                    )}
                </div>

                {/* Table Header for Desktop */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-white border border-gray-100 rounded-t-2xl text-[10px] font-black text-gray-400 border-b-2 uppercase tracking-widest shadow-sm mb-2">
                    <div className="col-span-5 cursor-pointer hover:text-[#881337] flex items-center gap-1" onClick={() => setSortConfig(p => ({ key: 'name', direction: p.key === 'name' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                        Name / Basic Info {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-2 cursor-pointer hover:text-[#881337] flex items-center gap-1" onClick={() => setSortConfig(p => ({ key: 'status', direction: p.key === 'status' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                        Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-2 cursor-pointer hover:text-[#881337] flex items-center gap-1" onClick={() => setSortConfig(p => ({ key: 'ejamaatId', direction: p.key === 'ejamaatId' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                        ITS Number {sortConfig.key === 'ejamaatId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                    <div className="col-span-3 cursor-pointer hover:text-[#881337] flex items-center gap-1" onClick={() => setSortConfig(p => ({ key: 'createdAt', direction: p.key === 'createdAt' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                        Joined Date {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </div>
                </div>

                {/* Results count */}
                <p className="text-[10px] text-gray-400 font-bold mb-3 tracking-wide uppercase">
                    Showing {activeMainTab === 'firestore' ? filteredAndSorted.length : authUsers.length} {activeMainTab === 'firestore' ? filterGender : ''} results (Total: {activeMainTab === 'firestore' ? stats.total : authUsers.length})
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-10 h-10 border-4 border-[#881337]/20 border-t-[#881337] rounded-full animate-spin" />
                    </div>
                ) : activeMainTab === 'firestore' ? (
                    <>
                        {filteredAndSorted.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                                <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 font-bold">No users found</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredAndSorted.map(u => {
                                    if (!u) return null;
                                    const statusCfg = STATUS_CONFIG[u.status || ''] || STATUS_CONFIG['pending_verification'];
                                    const userAge = age(u.dob);
                                    const now = Date.now();
                                    const createdTime = u.createdAt?.seconds ? u.createdAt.seconds * 1000 : new Date(u.createdAt || 0).getTime();
                                    const isNew = now - createdTime < 24 * 60 * 60 * 1000;
                                    const hasNewMsg = msgCounts[u.uid]?.userMsgs > 0;

                                    return (
                                        <div key={u.uid}
                                            className={`bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative ${hasNewMsg ? 'bg-blue-50/50 border-l-4 border-blue-500' : isNew ? 'bg-amber-50/30 border-l-4 border-amber-400' : ''}`}
                                            onClick={() => setSelectedUser(selectedUser?.uid === u.uid ? null : u)}>

                                            {/* Row */}
                                            <div className="flex items-center gap-4 p-4">
                                                {/* Avatar */}
                                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shrink-0 bg-gradient-to-br from-[#881337]/10 to-[#D4AF37]/10 flex items-center justify-center">
                                                    {u.libasImageUrl ? (
                                                        <img src={u.libasImageUrl} alt={u.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-[#881337] font-black text-sm">
                                                            {(u.name || u.email || '?').charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Main info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="font-black text-gray-900 text-sm">
                                                            {u.name || <span className="text-gray-400 italic">No name yet</span>}
                                                            {userAge ? `, ${userAge}` : ''}
                                                        </h3>
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${statusCfg.color}`}>
                                                            {statusCfg.icon} {statusCfg.label}
                                                        </span>
                                                        {isNew && (
                                                            <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">NEW</span>
                                                        )}
                                                        {hasNewMsg && (
                                                            <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center gap-1">
                                                                <MessageCircle className="w-2.5 h-2.5" /> NEW MSG
                                                            </span>
                                                        )}
                                                        {u.isCandidateFormComplete ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                                                                <CheckCircle className="w-2.5 h-2.5" /> Form Done
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gray-50 text-gray-400 border border-gray-100">
                                                                <Clock className="w-2.5 h-2.5" /> Incomplete
                                                            </span>
                                                        )}
                                                        {u.isItsVerified && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                <ShieldCheck className="w-2.5 h-2.5" /> ITS ✓
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        {u.email && (
                                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                <Mail className="w-3 h-3" /> {u.email}
                                                            </span>
                                                        )}
                                                        {u.mobile && (
                                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                <Phone className="w-3 h-3" /> {u.mobileCode} {u.mobile}
                                                            </span>
                                                        )}
                                                        {(u.city || u.country) && (
                                                            <span className="flex items-center gap-1 text-xs text-gray-500">
                                                                <MapPin className="w-3 h-3" /> {[u.city, u.state, u.country].filter(Boolean).join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right info */}
                                                <div className="hidden md:flex flex-col items-end gap-1 shrink-0 text-right group/row">
                                                    <div className="flex items-center gap-2">
                                                        {u.ejamaatId && <p className="text-xs font-black text-[#881337]">ITS: {u.ejamaatId}</p>}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.uid, u.name || ''); }}
                                                            className="p-1.5 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Delete Profile Completely"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    {u.jamaat && <p className="text-xs text-gray-400">{u.jamaat}</p>}
                                                    {u.gender && <p className="text-[10px] text-gray-400 capitalize">{u.gender}</p>}
                                                    <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wide">
                                                        {u.uid ? u.uid.substring(0, 8) : '...'}...
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Expanded detail panel */}
                                            {selectedUser?.uid === u.uid && (
                                                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 rounded-b-2xl">
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                        {[
                                                            { label: 'Firebase UID', value: u.uid },
                                                            { label: 'Email', value: u.email },
                                                            { label: 'ITS / EjamaatID', value: u.ejamaatId || u.itsNumber || '—' },
                                                            { label: 'Mobile', value: u.mobile ? `${u.mobileCode || ''} ${u.mobile}` : '—' },
                                                            { label: 'Gender', value: u.gender || '—' },
                                                            { label: 'DOB', value: u.dob || '—' },
                                                            { label: 'Marital Status', value: u.maritalStatus || '—' },
                                                            { label: 'Height', value: u.heightFeet ? `${u.heightFeet}'${u.heightInch || 0}"` : '—' },
                                                            { label: 'Education', value: u.educationDetails || u.education || '—' },
                                                            { label: 'Profession', value: u.professionType || '—' },
                                                            { label: 'Father', value: u.fatherName || '—' },
                                                            { label: 'Mother', value: u.motherName || '—' },
                                                            { label: 'City', value: u.city || '—' },
                                                            { label: 'State', value: u.state || '—' },
                                                            { label: 'Country', value: u.country || '—' },
                                                            { label: 'Jamaat', value: u.jamaat || '—' },
                                                        ].map(f => (
                                                            <div key={f.label} className="bg-white rounded-xl p-2.5 border border-gray-100">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-0.5">{f.label}</p>
                                                                <p className="font-bold text-gray-700 truncate">{f.value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {u.bio && (
                                                        <div className="mt-3 bg-white rounded-xl p-3 border border-gray-100">
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider mb-1">Bio</p>
                                                            <p className="text-xs text-gray-600 italic">{u.bio}</p>
                                                        </div>
                                                    )}
                                                    <div className="mt-3 flex gap-2 flex-wrap">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); impersonateUser(u.uid, u.email || 'user@example.com'); }}
                                                            className="bg-[#D4AF37] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#c29e2f] transition-colors flex items-center gap-2">
                                                            <User className="w-3.5 h-3.5" /> Assume Identity (Login as User)
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); router.push(`/admin/approvals`); }}
                                                            className="bg-[#881337] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#9F1239] transition-colors">
                                                            View in Approvals Panel →
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(u.uid); toast.success('UID copied!'); }}
                                                            className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
                                                            Copy UID
                                                        </button>
                                                        {u.email && (
                                                            <a
                                                                href={`mailto:${u.email}`}
                                                                onClick={e => e.stopPropagation()}
                                                                className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1">
                                                                <Mail className="w-3 h-3" /> Email
                                                            </a>
                                                        )}
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDeleteUser(u.uid, u.name || ''); }}
                                                            className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors shadow-md flex items-center gap-2">
                                                            <Trash2 className="w-3.5 h-3.5" /> Delete Profile Completely
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    /* Auth Directory Tab */
                    <div className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl flex items-center justify-between">
                            <div className="flex gap-4 items-center">
                                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-indigo-900 font-black text-xl">Identity Manager</h3>
                                    <p className="text-indigo-600 text-sm font-medium">All Unique Signups ({authUsers.length})</p>
                                </div>
                            </div>
                            <button
                                onClick={fetchAuthUsers}
                                disabled={loadingAuth}
                                className="bg-white text-indigo-600 px-6 py-2.5 rounded-2xl text-sm font-black border-2 border-indigo-100 hover:bg-indigo-50 transition-all flex items-center gap-2"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingAuth ? 'animate-spin' : ''}`} /> Sync Directory
                            </button>
                        </div>

                        {loadingAuth ? (
                            <div className="flex items-center justify-center py-24">
                                <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : authUsers.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                                <Mail className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                                <p className="text-gray-400 font-bold">No identities found in Auth</p>
                            </div>
                        ) : (
                            <div className="grid gap-2">
                                {authUsers.map((au, idx) => {
                                    if (!au) return null;
                                    const hasFirestore = users.some(u => u.uid === au.uid);
                                    const isGoogle = au.providers?.includes('google.com');

                                    const handleSendVerification = async (uid: string, email: string) => {
                                        try {
                                            const token = localStorage.getItem('admin_auth_token');
                                            const res = await fetch('/api/admin/send-verification', {
                                                method: 'POST',
                                                headers: {
                                                    'Authorization': token || '',
                                                    'Content-Type': 'application/json'
                                                },
                                                body: JSON.stringify({ uid, email })
                                            });
                                            const data = await res.json();
                                            if (data.success) toast.success('Verification link sent!');
                                            else toast.error(data.error || 'Failed to send link');
                                        } catch (e) {
                                            toast.error('API Error');
                                        }
                                    };

                                    return (
                                        <div key={au.uid} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl group hover:shadow-md transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 font-black text-xs border border-gray-100 shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-2">
                                                        {au.isMobileUser ? (
                                                            <span className="flex items-center gap-1.5 text-sm font-black text-gray-900">
                                                                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                                                {au.mobile}
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1.5 text-sm font-black text-gray-900">
                                                                <Mail className="w-3.5 h-3.5 text-blue-500" />
                                                                {au.email || 'Anonymous Account'}
                                                            </span>
                                                        )}
                                                        {au.emailVerified ? (
                                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                                        ) : (
                                                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-black uppercase tracking-tight">
                                                        <span className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 font-mono">{au.uid ? au.uid.substring(0, 16) : '...'}...</span>
                                                        <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${isGoogle ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                                            {isGoogle ? 'Google' : 'Password'}
                                                        </span>
                                                        <span>•</span>
                                                        <span>Joined: {new Date(au.creationTime).toLocaleDateString()}</span>
                                                        {au.lastSignInTime && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Active: {new Date(au.lastSignInTime).toLocaleDateString()}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!au.emailVerified && au.email && (
                                                    <button
                                                        onClick={() => handleSendVerification(au.uid, au.email)}
                                                        className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl text-[9px] font-black border border-indigo-100 hover:bg-indigo-100 transition-all flex items-center gap-1.5"
                                                    >
                                                        <Mail className="w-3 h-3" /> SEND VERIFICATION
                                                    </button>
                                                )}
                                                {hasFirestore ? (
                                                    <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full text-[9px] font-black border border-emerald-100 tracking-widest flex items-center gap-1.5">
                                                        <CheckCircle className="w-2.5 h-2.5" /> HAS BIODATA
                                                    </span>
                                                ) : (
                                                    <span className="bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-[9px] font-black border border-amber-100 tracking-widest flex items-center gap-1.5">
                                                        <ShieldAlert className="w-2.5 h-2.5" /> PENDING BIODATA
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(au.uid);
                                                        toast.success('UID copied!');
                                                    }}
                                                    className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
                                                    title="Copy UID"
                                                >
                                                    <User className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {/* Broadcast Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in duration-300">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center">
                                <Send className="w-5 h-5 text-indigo-600" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900">Broadcast Announcement</h2>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">Send a platform announcement to all registered candidates (e.g., Eid greetings, maintenance, etc.)</p>

                        <textarea
                            value={broadcastMsg}
                            onChange={e => setBroadcastMsg(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 h-32 resize-none mb-6"
                        />

                        <div className="flex gap-3">
                            <button onClick={() => setShowBroadcastModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 text-sm">Cancel</button>
                            <button
                                onClick={handleSendBroadcast}
                                disabled={!broadcastMsg.trim() || sendingBroadcast}
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {sendingBroadcast ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
