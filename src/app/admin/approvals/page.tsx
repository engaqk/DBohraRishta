"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { collection, query, getDocs, doc, updateDoc, onSnapshot, addDoc, serverTimestamp, orderBy, collectionGroup, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { ShieldAlert, CheckCircle, XCircle, BarChart3, Clock, ArrowRight, Key, MessageCircle, Send, PauseCircle, LogOut, Archive, Users, Smartphone, Trash2, ShieldCheck, Camera } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { ADMIN_EMAIL } from '@/lib/emailService';

interface PendingUser {
    id: string;
    name: string;
    itsNumber: string;
    jamaat: string;
    itsImageUrl: string | null;
    libasImageUrl: string | null;
    status: string;
    location?: string;
    hizratLocation?: string;
    mobileNumber?: string;
    adminMessage?: string;
    [key: string]: any;
}

interface AdminMessage {
    id: string;
    text: string;
    from: 'admin' | 'user';
    createdAt: any;
}

export default function AdminVerificationPage() {
    const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
    const [adminComment, setAdminComment] = useState("");
    const [activeDetailTab, setActiveDetailTab] = useState<'biodata' | 'messages'>('biodata');
    const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
    const [newAdminMsg, setNewAdminMsg] = useState("");
    const [msgCounts, setMsgCounts] = useState<Record<string, { total: number, userMsgs: number }>>({});
    const [requestStats, setRequestStats] = useState({ total: 0, accepted: 0 });
    const [searchQuery, setSearchQuery] = useState("");
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
    const [filterGender, setFilterGender] = useState<string>('male');
    const [visibleCount, setVisibleCount] = useState(50); // Pagination
    const { user, impersonateUser } = useAuth();
    const router = useRouter();

    const [sortConfig, setSortConfig] = useState<{ key: keyof PendingUser; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

    const sortedUsers = useMemo(() => {
        const filtered = allUsers.filter(u => {
            const matchesSearch = !searchQuery ||
                u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.itsNumber?.includes(searchQuery) ||
                u.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.hizratLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.jamaat?.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesGender = u.gender?.toLowerCase() === filterGender;
            return matchesSearch && matchesGender;
        });

        const sorted = [...filtered].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Handle date strings or Firestore timestamps
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

        return sorted;
    }, [allUsers, searchQuery, sortConfig, filterGender]);

    // Reset pagination when filter/search changes
    useEffect(() => {
        setVisibleCount(50);
    }, [searchQuery, filterGender]);

    const genderCounts = useMemo(() => ({
        male: allUsers.filter(u => u.gender?.toLowerCase() === 'male').length,
        female: allUsers.filter(u => u.gender?.toLowerCase() === 'female').length
    }), [allUsers]);

    const analytics = useMemo(() => {
        return {
            totalUsers: allUsers.length,
            pendingCount: allUsers.filter(u => !u.status || u.status === 'pending' || u.status === 'pending_verification').length,
            holdCount: allUsers.filter(u => u.status === 'hold').length,
            acceptedRatio: requestStats.total > 0 ? Math.round((requestStats.accepted / requestStats.total) * 100) : 0,
        };
    }, [allUsers, requestStats]);

    const fetchDashboardData = useCallback(async () => {
        if (allUsers.length === 0) setLoading(true);
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/dashboard-data', {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            
            if (data.users) {
                setAllUsers(data.users);
            }
            if (data.msgCounts) {
                setMsgCounts(data.msgCounts);
            }
            if (data.requestStats) {
                setRequestStats(data.requestStats);
            }
        } catch (e) {
            console.error('Failed to fetch dashboard data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

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
                setAllUsers(prev => prev.filter(u => u.id !== userId));
                if (selectedUser?.id === userId) closeDetails();
            } else {
                toast.error(data.error || 'Failed to delete user');
            }
        } catch (e: any) {
            toast.error('Network error during deletion');
        }
    };

    const handleVerifySelfie = async (userId: string, isApproved: boolean) => {
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/users/verify-selfie', {
                method: 'POST',
                headers: { 
                    'Authorization': token || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId, adminId: user?.uid, isApproved })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(isApproved ? 'Photo Identity Verified!' : 'Selfie Rejected');
                fetchDashboardData();
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, isPhotoVerified: isApproved, selfieStatus: isApproved ? 'verified' : 'rejected' } : null);
                }
            } else {
                toast.error(data.error);
            }
        } catch (e: any) {
            toast.error('Failed to update selfie status');
        }
    };

    useEffect(() => {
        const isAdmin = localStorage.getItem("admin_auth_token");
        if (!isAdmin) {
            router.push('/admin/login');
            return;
        }

        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, [router, fetchDashboardData]);

    // Fetch messages for selected user
    const fetchMessages = useCallback(async () => {
        if (!selectedUser) return;
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch(`/api/admin/user-messages?userId=${selectedUser.id}`, {
                headers: { 'Authorization': token || '' }
            });
            const data = await res.json();
            if (data.messages) {
                setAdminMessages(data.messages);
            }
        } catch (e) {
            console.error('Failed to fetch messages:', e);
        }
    }, [selectedUser?.id]);

    useEffect(() => {
        if (selectedUser) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 10000); // More frequent refresh for messages
            return () => clearInterval(interval);
        }
    }, [selectedUser, fetchMessages]);


    const handleStatusMove = async (userId: string, newStatus: string, message?: string) => {
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/users/update-status', {
                method: 'POST',
                headers: { 
                    'Authorization': token || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
                    newStatus,
                    message,
                    adminId: user?.uid
                })
            });
            
            const data = await res.json();
            if (data.success) {
                toast.success(`User moved to ${newStatus}`);
                fetchDashboardData(); // Refresh list via API
                if (selectedUser?.id === userId) {
                    setSelectedUser(prev => prev ? { ...prev, status: newStatus, adminMessage: message || prev.adminMessage } : null);
                    fetchMessages(); // Refresh messages
                }

                // If they have an email, we still try to send it (already handled in UI previously, 
                // but let's just keep the API result as source of truth for UI state)
            } else {
                toast.error("Failed: " + data.error);
            }
        } catch (error: any) {
            console.error("Error updating status:", error);
            toast.error("Network error updating status");
        }
    };

    const handleSendAdminMessage = async () => {
        if (!newAdminMsg.trim() || !selectedUser) return;
        try {
            const token = localStorage.getItem('admin_auth_token');
            const res = await fetch('/api/admin/user-messages', {
                method: 'POST',
                headers: { 
                    'Authorization': token || '',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    text: newAdminMsg.trim(),
                    from: 'admin'
                })
            });
            const data = await res.json();
            if (data.success) {
                setNewAdminMsg("");
                toast.success("Message sent to user.");
                fetchMessages(); // Refresh thread

                // Send email notification
                const userEmail = selectedUser.notificationEmail || selectedUser.email || selectedUser.mobileEmail;
                if (userEmail && userEmail.includes('@')) {
                    const { notifyNewAdminMessage } = await import('@/lib/emailService');
                    notifyNewAdminMessage({
                        candidateName: selectedUser.name,
                        candidateEmail: userEmail,
                        messageSnippet: newAdminMsg.trim()
                    }).catch(e => console.error("Admin msg email failed", e));
                }
            } else {
                toast.error(data.error);
            }
        } catch (error: any) {
             toast.error("Failed to send message");
        }
    };
 
    const markMessagesAsRead = async (userId: string) => {
        try {
            const threadRef = collection(db, "admin_messages", userId, "thread");
            // Use single where clause to avoid needing a composite index.
            // Filter readByAdmin client-side.
            const q = query(threadRef, where("from", "==", "user"));
            const snap = await getDocs(q);
 
            if (snap.empty) return;
 
            // Filter client-side: only docs where readByAdmin is not already true
            const unreadDocs = snap.docs.filter(d => d.data().readByAdmin !== true);
            if (unreadDocs.length === 0) return;
 
            const batch = writeBatch(db);
            unreadDocs.forEach(d => {
                batch.update(d.ref, { readByAdmin: true });
            });
            await batch.commit();
        } catch (e) {
            console.error("Failed to mark messages as read", e);
        }
    };
 
    // Auto-mark messages as read when admin opens the tab
    useEffect(() => {
        if (selectedUser && activeDetailTab === 'messages') {
            markMessagesAsRead(selectedUser.id);
        }
    }, [selectedUser?.id, activeDetailTab]);


    const openDetails = (u: PendingUser, tab: 'biodata' | 'messages' = 'biodata') => {
        setSelectedUser(u);
        setAdminComment(u.adminMessage || "");
        setActiveDetailTab(tab);
    };
    const closeDetails = () => { setSelectedUser(null); setAdminComment(""); };

    const getStatusColor = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'pending') return 'bg-orange-50 text-orange-700 border-orange-200';
        if (status === 'verified' || status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'hold') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        if (status === 'archived') return 'bg-gray-700 text-white border-gray-600';
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getStatusLabel = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'pending') return 'Pending Verification';
        if (status === 'under_review') return 'Under Review';
        if (status === 'verified') return 'Verified';
        if (status === 'approved') return 'Approved';
        if (status === 'rejected') return 'Rejected';
        if (status === 'hold') return '⏸ On Hold';
        if (status === 'archived') return '🗄 Archived';
        return status;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-[1400px] w-full mx-auto">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] rounded-full flex items-center justify-center font-bold text-xl shadow-[0_0_20px_rgba(212,175,55,0.4)] border-2 border-[#D4AF37] ring-4 ring-white/20">53</div>
                        <div>
                            <h1 className="text-2xl font-extrabold font-serif text-[#881337] tracking-tight leading-tight">DBohra<span className="text-[#D4AF37] font-medium italic">Rishta</span></h1>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] leading-none mt-1">Admin Control Panel</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#881337] transition-all shadow-sm"
                            />
                        </div>

                        <button
                            onClick={() => router.push('/admin/users')}
                            className="bg-blue-50 hover:bg-white text-blue-700 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all border border-blue-100 hover:border-blue-400"
                        >
                            <Users className="w-3.5 h-3.5" /> Registered Users
                        </button>
                        <button
                            onClick={() => router.push('/admin/broadcast')}
                            className="bg-purple-50 hover:bg-white text-purple-700 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all border border-purple-100 hover:border-purple-400"
                        >
                            <Send className="w-3.5 h-3.5" /> Broadcast Push
                        </button>
                        <button
                            onClick={() => router.push('/admin/sms-broadcast')}
                            className="bg-emerald-50 hover:bg-white text-emerald-700 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all border border-emerald-100 hover:border-emerald-400"
                        >
                            <Smartphone className="w-3.5 h-3.5" /> Broadcast SMS
                        </button>
                        <button
                            onClick={() => router.push('/admin/audit-logs')}
                            className="bg-gray-800 hover:bg-gray-950 text-white px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all border border-gray-700"
                        >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Audit Logs
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem("admin_auth_token");
                                toast.success("Admin session terminated.");
                                router.push('/admin/login');
                            }}
                            className="bg-white hover:bg-gray-50 text-gray-700 px-5 py-2.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all border border-gray-200"
                        >
                            <LogOut className="w-3.5 h-3.5" /> Secure Logout
                        </button>
                    </div>
                </div>

                {/* Full-screen Detail View */}
                {selectedUser && (
                    <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col overflow-y-auto w-full h-full text-left">
                        <div className="bg-white px-6 py-4 shadow-sm sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100">
                            <button onClick={closeDetails} className="text-gray-500 hover:text-[#881337] flex items-center gap-2 font-bold px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                                ← Back to Grid
                            </button>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-[#881337]">{selectedUser.name}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(selectedUser.status)}`}>{getStatusLabel(selectedUser.status)}</span>
                            </div>
                            <div className="flex gap-2 items-center">
                                <button onClick={() => setActiveDetailTab('biodata')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeDetailTab === 'biodata' ? 'bg-[#881337] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Biodata</button>
                                <button onClick={() => setActiveDetailTab('messages')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeDetailTab === 'messages' ? 'bg-[#881337] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    <MessageCircle className="w-3.5 h-3.5" /> Messages {adminMessages.length > 0 && <span className="bg-rose-500 text-white rounded-full px-1.5 text-[9px]">{adminMessages.length}</span>}
                                </button>

                                {/* Right Top Close Button */}
                                <button
                                    onClick={closeDetails}
                                    className="ml-2 w-10 h-10 flex items-center justify-center bg-rose-50 text-[#881337] rounded-full hover:bg-rose-100 transition-all border border-rose-100 shadow-sm"
                                    title="Close details"
                                >
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
                            {/* ── BIODATA TAB ── */}
                            {activeDetailTab === 'biodata' && (
                                <>
                                    <h3 className="text-2xl font-bold mb-6 text-[#881337] border-b pb-2">Complete Biodata</h3>
                                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">ITS Number</p><p className="font-medium text-[#881337]">{selectedUser.itsNumber}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">DOB</p><p className="font-medium text-gray-800">{selectedUser.dob || "N/A"}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Gender & Height</p><p className="font-medium text-gray-800 capitalize">{selectedUser.gender || "N/A"} • {selectedUser.heightFeet ? `${selectedUser.heightFeet}' ${selectedUser.heightInch}"` : "N/A"}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Marital Status</p><p className="font-medium text-gray-800 capitalize">{selectedUser.maritalStatus || "Single"}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Jamaat</p><p className="font-medium text-gray-800">{selectedUser.jamaat}</p></div>
                                         <div><p className="text-gray-500 uppercase text-[10px] font-bold">Location</p><p className="font-medium text-gray-800">{selectedUser.location || selectedUser.hizratLocation}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Mobile</p><p className="font-medium text-gray-800">{selectedUser.mobile || selectedUser.mobileNumber || "Not set"}</p></div>
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Email</p><p className="font-medium text-gray-800">{selectedUser.email || "Not set"}</p></div>
                                        <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Education</p><p className="font-medium text-gray-800">{selectedUser.completedUpto || "N/A"} — {selectedUser.educationDetails || "No details"}</p></div>
                                        <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Profession</p><p className="font-medium text-gray-800">{selectedUser.professionType || "N/A"} — {selectedUser.serviceType || "N/A"}</p></div>
                                        <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Parents</p><p className="font-medium text-gray-800 text-xs">Father: {selectedUser.fatherName || "N/A"} | Mother: {selectedUser.motherName || "N/A"}</p></div>
                                        <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Bio</p><p className="font-medium text-gray-800 italic">{selectedUser.bio || "None"}</p></div>
                                        <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Partner Qualities</p><p className="font-medium text-gray-800 text-xs">{selectedUser.partnerQualities || "None"}</p></div>
                                    </div>

                                    <div className="flex gap-4 mb-6">
                                        {selectedUser.itsImageUrl && (
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-xs font-bold text-gray-500">ITS Card / Photo</p>
                                                    {selectedUser.status === 'pending_verification' && (
                                                        <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">🔄 Re-submitted — Pending Re-verification</span>
                                                    )}
                                                </div>
                                                <div
                                                    className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden border-2 border-amber-300 shadow cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setFullscreenImage(selectedUser.itsImageUrl)}
                                                >
                                                    <img src={selectedUser.itsImageUrl} alt="ITS Doc" className="w-full h-full object-contain" loading="lazy" />
                                                </div>
                                            </div>
                                        )}
                                        {selectedUser.libasImageUrl && (
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-gray-500 mb-1">Libas Photo</p>
                                                <div
                                                    className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setFullscreenImage(selectedUser.libasImageUrl)}
                                                >
                                                    <img src={selectedUser.libasImageUrl} alt="Libas Photo" className="w-full h-full object-cover" loading="lazy" />
                                                </div>
                                            </div>
                                        )}
                                        {(selectedUser.selfieImageUrl || selectedUser.selfieUrl) && (
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-xs font-bold text-blue-600 uppercase tracking-tight">Selfie Verification</p>
                                                    {selectedUser.selfieStatus === 'pending' && <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse uppercase">PENDING REVIEW</span>}
                                                    {selectedUser.isPhotoVerified && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                                                </div>
                                                <div
                                                    className="w-full h-48 bg-gray-100 rounded-xl overflow-hidden border-2 border-blue-200 shadow cursor-pointer hover:opacity-90 transition-opacity"
                                                    onClick={() => setFullscreenImage(selectedUser.selfieImageUrl || selectedUser.selfieUrl)}
                                                >
                                                    <img src={selectedUser.selfieImageUrl || selectedUser.selfieUrl} alt="Selfie" className="w-full h-full object-cover" loading="lazy" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Selfie Action Button */}
                                    {(selectedUser.selfieImageUrl || selectedUser.selfieUrl) && !selectedUser.isPhotoVerified && (
                                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                                    <Camera size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-blue-900 uppercase">Selfie Comparison Ready</p>
                                                    <p className="text-[10px] text-blue-600">Compare the selfie with the Libas photo to verify identity.</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleVerifySelfie(selectedUser.id, false)}
                                                    className="px-4 py-2 bg-white text-rose-600 border border-rose-100 font-bold text-xs rounded-xl hover:bg-rose-50"
                                                >
                                                    Reject Selfie
                                                </button>
                                                <button 
                                                    onClick={() => handleVerifySelfie(selectedUser.id, true)}
                                                    className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-900/20 flex items-center gap-2"
                                                >
                                                    <ShieldCheck size={14} /> Verify Selfie
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Admin Action Panel */}
                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-3">
                                        <h4 className="font-bold text-[#881337] text-sm uppercase tracking-wide">Admin Note / Message to User</h4>
                                        <p className="text-xs text-gray-500">This message will display as a banner to the user in their dashboard and biodata form. It will also appear in their message thread.</p>
                                        <textarea
                                            value={adminComment}
                                            onChange={(e) => setAdminComment(e.target.value)}
                                            placeholder="e.g. Please upload a clearer ITS photo in proper lighting."
                                            className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#881337] resize-none h-20"
                                        />
                                        <div className="flex flex-wrap gap-3 justify-end mt-2">
                                            {/* HOLD */}
                                            <button
                                                onClick={() => { handleStatusMove(selectedUser.id, 'hold', adminComment); closeDetails(); }}
                                                className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                            >
                                                <PauseCircle className="w-4 h-4" /> Put on Hold
                                            </button>
                                            {/* VERIFY / ACCEPT */}
                                            {selectedUser.status !== 'approved' && selectedUser.status !== 'verified' && (
                                                <button onClick={() => { handleStatusMove(selectedUser.id, 'verified', adminComment); closeDetails(); }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4" /> Verify / Accept
                                                </button>
                                            )}
                                            {selectedUser.status === 'verified' && (
                                                <button onClick={() => { handleStatusMove(selectedUser.id, 'approved', adminComment); closeDetails(); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm">Final Approve</button>
                                            )}
                                            {/* REJECT */}
                                            {selectedUser.status !== 'rejected' && (
                                                <button onClick={() => { handleStatusMove(selectedUser.id, 'rejected', adminComment); closeDetails(); }} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2">
                                                    <XCircle className="w-4 h-4" /> Reject Profile
                                                </button>
                                            )}
                                            {/* ARCHIVE */}
                                            {selectedUser.status !== 'archived' ? (
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Archive ${selectedUser.name}'s profile? They will no longer be able to log in.`)) {
                                                            handleStatusMove(selectedUser.id, 'archived', 'Your profile has been archived by the administration. Please contact support for further assistance.');
                                                            closeDetails();
                                                        }
                                                    }}
                                                    className="px-5 py-2.5 bg-gray-700 hover:bg-gray-800 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                                >
                                                    <Archive className="w-4 h-4" /> Archive Profile
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => { handleStatusMove(selectedUser.id, 'pending', 'Your profile has been restored. Please log in to continue.'); closeDetails(); }}
                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center gap-2"
                                                >
                                                    <CheckCircle className="w-4 h-4" /> Restore Profile
                                                </button>
                                            )}
                                            <button onClick={closeDetails} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors">Close</button>
                                            
                                            <div className="w-full h-px bg-gray-100 my-2" />
                                            
                                            <div className="flex gap-3 justify-end w-full">
                                                <button
                                                    onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name)}
                                                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors shadow-md flex items-center gap-2"
                                                >
                                                    <Smartphone className="w-4 h-4" /> Delete Profile Completely
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── MESSAGES TAB ── */}
                            {activeDetailTab === 'messages' && (
                                <div className="flex flex-col h-full">
                                    <h3 className="text-xl font-bold mb-4 text-[#881337] border-b pb-2 flex items-center gap-2">
                                        <MessageCircle className="w-5 h-5" /> Message Thread with {selectedUser.name}
                                    </h3>
                                    <div className="flex flex-col gap-3 mb-4 min-h-[300px] max-h-[500px] overflow-y-auto bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                                        {adminMessages.length === 0 && (
                                            <div className="text-center text-gray-400 text-sm pt-10">No messages yet. Send a message below.</div>
                                        )}
                                        {adminMessages.map(msg => (
                                            <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.from === 'admin' ? 'bg-[#881337] text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                                                    <p className="font-semibold text-[10px] uppercase mb-1 opacity-70">{msg.from === 'admin' ? 'Admin' : selectedUser.name}</p>
                                                    <p>{msg.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={newAdminMsg}
                                            onChange={(e) => setNewAdminMsg(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendAdminMessage(); }}
                                            placeholder="Type a message to the user..."
                                            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#881337] bg-gray-50"
                                        />
                                        <button onClick={handleSendAdminMessage} className="bg-[#881337] text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-rose-900 transition-colors flex items-center gap-2 shadow-sm">
                                            <Send className="w-4 h-4" /> Send
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {loading && allUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 text-gray-500 font-bold">
                        <div className="w-12 h-12 border-4 border-rose-100 border-t-rose-900 rounded-full animate-spin mb-4" />
                        <p className="animate-pulse tracking-widest uppercase text-xs">Scanning database identities...</p>
                    </div>
                ) : (
                    <>
                        {/* Premium Analytics Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-5 hover:scale-[1.02] transition-all group cursor-default">
                                <div className="w-14 h-14 bg-rose-50 text-[#881337] rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors shadow-inner">
                                    <BarChart3 className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400/80 mb-1">Total Users</p>
                                    <h2 className="text-3xl font-black font-serif text-[#881337]">{analytics.totalUsers}</h2>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-5 hover:scale-[1.02] transition-all group cursor-default">
                                <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors shadow-inner">
                                    <Clock className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400/80 mb-1">Pending</p>
                                    <h2 className="text-3xl font-black font-serif text-orange-600">{analytics.pendingCount}</h2>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-5 hover:scale-[1.02] transition-all group cursor-default">
                                <div className="w-14 h-14 bg-yellow-50 text-yellow-500 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-yellow-100 transition-colors shadow-inner">
                                    <PauseCircle className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400/80 mb-1">On Hold</p>
                                    <h2 className="text-3xl font-black font-serif text-yellow-600">{analytics.holdCount}</h2>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/50 flex items-center gap-5 hover:scale-[1.02] transition-all group cursor-default">
                                <div className="w-14 h-14 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors shadow-inner">
                                    <CheckCircle className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400/80 mb-1">Match Rate</p>
                                    <h2 className="text-3xl font-black font-serif text-emerald-600">{analytics.acceptedRatio}%</h2>
                                </div>
                            </div>
                        </div>

                        {/* ── SELFIE VERIFICATION PIPELINE ── */}
                        {(() => {
                            const selfieQueue = allUsers.filter(u =>
                                (u.selfieImageUrl || u.selfieUrl) && u.selfieStatus === 'pending' && !u.isPhotoVerified
                            );
                            if (selfieQueue.length === 0) return null;
                            return (
                                <div className="mb-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                                            <Camera className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Selfie Verification Queue</h3>
                                            <p className="text-[10px] text-blue-600 font-bold">{selfieQueue.length} selfie{selfieQueue.length > 1 ? 's' : ''} awaiting review</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {selfieQueue.map(u => (
                                            <div key={u.id} className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm overflow-hidden">
                                                <div className="flex gap-0">
                                                    {/* Selfie */}
                                                    <div className="flex-1 relative">
                                                        <p className="absolute top-2 left-2 z-10 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Selfie</p>
                                                        <img
                                                            src={u.selfieImageUrl || u.selfieUrl}
                                                            alt="selfie"
                                                            className="w-full h-40 object-cover cursor-zoom-in"
                                                            onClick={() => setFullscreenImage(u.selfieImageUrl || u.selfieUrl)}
                                                        />
                                                    </div>
                                                    {/* Libas */}
                                                    {u.libasImageUrl && (
                                                        <div className="flex-1 relative">
                                                            <p className="absolute top-2 left-2 z-10 bg-gray-700 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase">Libas</p>
                                                            <img
                                                                src={u.libasImageUrl}
                                                                alt="libas"
                                                                className="w-full h-40 object-cover cursor-zoom-in"
                                                                onClick={() => setFullscreenImage(u.libasImageUrl)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <p className="font-black text-sm text-gray-900">{u.name}</p>
                                                            <p className="text-[10px] text-gray-400 font-bold">{u.location || u.hizratLocation} · {u.itsNumber}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => openDetails(u, 'biodata')}
                                                            className="text-[10px] text-blue-600 font-black uppercase hover:underline"
                                                        >
                                                            Full Profile →
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleVerifySelfie(u.id, false)}
                                                            className="flex-1 py-2 bg-rose-50 text-rose-600 border border-rose-100 font-black text-[10px] rounded-xl uppercase hover:bg-rose-100"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleVerifySelfie(u.id, true)}
                                                            className="flex-1 py-2 bg-blue-600 text-white font-black text-[10px] rounded-xl uppercase hover:bg-blue-700 shadow-md shadow-blue-200 flex items-center justify-center gap-1"
                                                        >
                                                            <ShieldCheck className="w-3 h-3" /> Approve
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="bg-white border-b border-gray-100 mb-6 rounded-2xl overflow-hidden shadow-sm flex items-center px-4">
                            {(['male', 'female'] as const).map(g => (
                                <button
                                    key={g}
                                    onClick={() => setFilterGender(g)}
                                    className={`py-4 px-6 text-[10px] font-black uppercase tracking-widest transition-all relative ${filterGender === g ? 'text-[#881337]' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    {g}s ({g === 'male' ? genderCounts.male : genderCounts.female})
                                    {filterGender === g && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#881337] rounded-full" />}
                                </button>
                            ))}
                        </div>

                {/* Results count */}
                <p className="text-[10px] text-gray-400 font-bold mb-3 tracking-wide uppercase">
                    Showing {sortedUsers.length} {filterGender} profiles (Total: {analytics.totalUsers})
                </p>

                <div className="mb-4"><h2 className="text-xl font-bold font-serif uppercase tracking-widest text-[#881337]">Profile Approval Pipeline</h2></div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'name', direction: p.key === 'name' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Profile / Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'itsNumber', direction: p.key === 'itsNumber' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    ITS Number {sortConfig.key === 'itsNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'location', direction: p.key === 'location' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Location {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'status', direction: p.key === 'status' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'createdAt', direction: p.key === 'createdAt' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Joined Date {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 text-right">Actions</div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {sortedUsers.slice(0, visibleCount).map((u, idx) => {
                                    const hasNewMsgs = (msgCounts[u.id]?.userMsgs || 0) > 0;
                                    return (
                                        <div key={u.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors group relative">
                                            {/* Profile Column */}
                                            <div className="col-span-2 flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                                                        <img 
                                                            src={u.itsImageUrl || '/placeholder-its.png'} 
                                                            alt="" 
                                                            className="w-full h-full object-cover"
                                                            loading="lazy" 
                                                        />
                                                    </div>
                                                    {u.isPhotoVerified && (
                                                        <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border-2 border-white">
                                                            <ShieldCheck className="w-2.5 h-2.5" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col">
                                                    <p className="font-bold text-sm text-[#881337] truncate max-w-[120px]">{u.name}</p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">{u.gender || 'Unknown'}</p>
                                                </div>
                                            </div>

                                            {/* ITS Column */}
                                            <div className="col-span-2">
                                                <span className="text-xs font-mono font-bold text-gray-600">{u.itsNumber}</span>
                                            </div>

                                            {/* Location Column */}
                                            <div className="col-span-2">
                                                <div className="flex flex-col">
                                                    <p className="text-xs font-bold text-gray-700 truncate">{u.location || u.hizratLocation}</p>
                                                    <p className="text-[9px] text-gray-400 truncate">{u.jamaat}</p>
                                                </div>
                                            </div>

                                            {/* Status Column */}
                                            <div className="col-span-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-tighter ${getStatusColor(u.status)}`}>
                                                    {getStatusLabel(u.status)}
                                                </span>
                                            </div>

                                            {/* Date Column */}
                                            <div className="col-span-2">
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : new Date(u.createdAt || 0).toLocaleDateString()}
                                                </p>
                                            </div>

                                            {/* Action Column */}
                                            <div className="col-span-2 flex items-center justify-end gap-2">
                                                {hasNewMsgs && (
                                                    <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse mr-1" title="New messages" />
                                                )}
                                                <button 
                                                    onClick={() => openDetails(u)}
                                                    className="px-4 py-1.5 bg-gray-100 hover:bg-[#881337] hover:text-white text-gray-600 rounded-lg text-[10px] font-black uppercase transition-all"
                                                >
                                                    View Details
                                                </button>
                                                <button 
                                                    onClick={() => openDetails(u, 'messages')}
                                                    className={`p-2 rounded-lg transition-all ${hasNewMsgs ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'text-gray-400 hover:bg-gray-100'}`}
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}

                                {sortedUsers.length > visibleCount && (
                                    <div className="p-8 flex justify-center bg-gray-50/50">
                                        <button 
                                            onClick={() => setVisibleCount(prev => prev + 50)}
                                            className="bg-white border-2 border-rose-50 px-10 py-3 rounded-2xl text-[11px] font-black text-[#881337] shadow-sm hover:scale-105 transition-all flex items-center gap-3 uppercase tracking-[0.2em]"
                                        >
                                            <ArrowRight className="w-4 h-4" /> Load More Profiles ({sortedUsers.length - visibleCount} hidden)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
                {/* Image Full-View Modal for Admin */}
                {fullscreenImage && (
                    <div
                        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-300"
                        onClick={() => setFullscreenImage(null)}
                    >
                        <button
                            className="absolute top-8 right-8 z-[210] w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#881337] shadow-xl hover:bg-rose-50 hover:scale-110 active:scale-90 transition-all border-4 border-[#881337]/20"
                            onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
                        >
                            <XCircle className="w-8 h-8" />
                        </button>
                        <div className="max-w-5xl max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                            <img src={fullscreenImage} alt="Full View" className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-white/10" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
