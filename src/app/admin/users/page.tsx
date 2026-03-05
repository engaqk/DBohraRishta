"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { Users, Search, ArrowLeft, ShieldCheck, Clock, XCircle, CheckCircle, Archive, Mail, Phone, User, Calendar, MapPin, RefreshCw } from "lucide-react";
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
    const { user } = useAuth();
    const router = useRouter();
    const [users, setUsers] = useState<RegistrationUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterComplete, setFilterComplete] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<RegistrationUser | null>(null);

    // Admin auth guard
    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) { router.push('/admin/login'); return; }
    }, [router]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, 'users'));
            const list: RegistrationUser[] = snap.docs.map(d => ({
                uid: d.id,
                ...d.data(),
            }));
            // Sort: newest first (by createdAt if available, else by name)
            list.sort((a, b) => {
                const ta = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                const tb = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                return tb - ta;
            });
            setUsers(list);
        } catch (e: any) {
            toast.error('Failed to load users: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const filtered = useMemo(() => {
        return users.filter(u => {
            const matchSearch = !search ||
                u.name?.toLowerCase().includes(search.toLowerCase()) ||
                u.email?.toLowerCase().includes(search.toLowerCase()) ||
                u.ejamaatId?.includes(search) ||
                u.itsNumber?.includes(search) ||
                u.mobile?.includes(search) ||
                u.city?.toLowerCase().includes(search.toLowerCase()) ||
                u.jamaat?.toLowerCase().includes(search.toLowerCase());

            const matchStatus = filterStatus === 'all' || u.status === filterStatus;
            const matchComplete = filterComplete === 'all' ||
                (filterComplete === 'complete' && u.isCandidateFormComplete) ||
                (filterComplete === 'incomplete' && !u.isCandidateFormComplete);

            return matchSearch && matchStatus && matchComplete;
        });
    }, [users, search, filterStatus, filterComplete]);

    const stats = useMemo(() => ({
        total: users.length,
        complete: users.filter(u => u.isCandidateFormComplete).length,
        pending: users.filter(u => u.status === 'pending_verification').length,
        verified: users.filter(u => u.status === 'verified' || u.status === 'approved').length,
        archived: users.filter(u => u.status === 'archived').length,
    }), [users]);

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
                    <button onClick={fetchUsers}
                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl text-sm font-bold transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    {[
                        { label: 'Total Registered', value: stats.total, color: 'text-[#881337]', bg: 'bg-rose-50 border-rose-100' },
                        { label: 'Form Complete', value: stats.complete, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100' },
                        { label: 'Pending Review', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
                        { label: 'Verified', value: stats.verified, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                        { label: 'Archived', value: stats.archived, color: 'text-gray-500', bg: 'bg-gray-50 border-gray-100' },
                    ].map(s => (
                        <div key={s.label} className={`${s.bg} border rounded-2xl p-4 text-center`}>
                            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                            <p className="text-xs font-bold text-gray-500 mt-1">{s.label}</p>
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
                        <option value="all">All Profiles</option>
                        <option value="complete">Form Complete</option>
                        <option value="incomplete">Form Incomplete</option>
                    </select>
                </div>

                {/* Results count */}
                <p className="text-xs text-gray-400 font-bold mb-3 tracking-wide uppercase">
                    Showing {filtered.length} of {users.length} users
                </p>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-10 h-10 border-4 border-[#881337]/20 border-t-[#881337] rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
                        <Users className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-gray-400 font-bold">No users found</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filtered.map(u => {
                            const statusCfg = STATUS_CONFIG[u.status || ''] || STATUS_CONFIG['pending_verification'];
                            const userAge = age(u.dob);
                            return (
                                <div key={u.uid}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer"
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
                                        <div className="hidden md:flex flex-col items-end gap-1 shrink-0 text-right">
                                            {u.ejamaatId && <p className="text-xs font-black text-[#881337]">ITS: {u.ejamaatId}</p>}
                                            {u.jamaat && <p className="text-xs text-gray-400">{u.jamaat}</p>}
                                            {u.gender && <p className="text-[10px] text-gray-400 capitalize">{u.gender}</p>}
                                            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wide">
                                                {u.uid.substring(0, 8)}...
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
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
