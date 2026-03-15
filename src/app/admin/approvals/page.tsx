"use client";

import React, { useEffect, useState, useMemo } from "react";
import { collection, query, getDocs, doc, updateDoc, onSnapshot, addDoc, serverTimestamp, orderBy, collectionGroup, writeBatch, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { auth } from "@/lib/firebase/config";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { ShieldAlert, CheckCircle, XCircle, BarChart3, Clock, ArrowRight, Key, MessageCircle, Send, PauseCircle, LogOut, Archive, Users, Smartphone } from "lucide-react";
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
    hizratLocation: string;
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
    const { user } = useAuth();
    const router = useRouter();

    const [sortConfig, setSortConfig] = useState<{ key: keyof PendingUser; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

    const sortedUsers = useMemo(() => {
        const filtered = allUsers.filter(u =>
            !searchQuery ||
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.itsNumber?.includes(searchQuery) ||
            u.hizratLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.jamaat?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        return [...filtered].sort((a, b) => {
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
    }, [allUsers, searchQuery, sortConfig]);

    const analytics = useMemo(() => {
        return {
            totalUsers: sortedUsers.length,
            pendingCount: sortedUsers.filter(u => !u.status || u.status === 'pending' || u.status === 'pending_verification').length,
            holdCount: sortedUsers.filter(u => u.status === 'hold').length,
            acceptedRatio: requestStats.total > 0 ? Math.round((requestStats.accepted / requestStats.total) * 100) : 0,
        };
    }, [sortedUsers, requestStats]);

    useEffect(() => {
        const isAdmin = localStorage.getItem("admin_auth_token");
        if (!isAdmin) {
            router.push('/admin/login');
            return;
        }

        let usersUnsub: (() => void) | null = null;
        let requestsUnsub: (() => void) | null = null;
        let threadUnsub: (() => void) | null = null;

        const startFirestoreListeners = () => {
            // Live stats for users
            usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
                setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as PendingUser)));
                setLoading(false);
            }, err => {
                console.error('Users snapshot error:', err.message);
                setLoading(false);
            });

            // Live stats for requests (Match Rate)
            requestsUnsub = onSnapshot(collection(db, "rishta_requests"), (snap) => {
                const total = snap.docs.length;
                const accepted = snap.docs.filter(d => d.data().status === 'accepted').length;
                setRequestStats({ total, accepted });
            }, err => console.warn('Requests snapshot error:', err.message));

            // Unread message counts
            threadUnsub = onSnapshot(collectionGroup(db, "thread"), (snapshot) => {
                const counts: Record<string, { total: number, userMsgs: number }> = {};
                snapshot.docs.forEach(doc => {
                    const parentId = doc.ref.parent.parent?.id;
                    if (!parentId) return;
                    const data = doc.data();
                    if (!counts[parentId]) counts[parentId] = { total: 0, userMsgs: 0 };
                    counts[parentId].total++;
                    if (data.from === 'user') counts[parentId].userMsgs++;
                });
                setMsgCounts(counts);
            }, err => console.warn('Thread snapshot error:', err.message));
        };

        // Ensure a Firebase auth session exists before subscribing to Firestore.
        // If no session → sign in anonymously so Firestore rules (signedIn()) pass.
        const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Session exists — start listeners
                startFirestoreListeners();
            } else {
                // No session — try anonymous sign-in to satisfy Firestore rules
                try {
                    await signInAnonymously(auth);
                    // onAuthStateChanged will re-fire with the anonymous user
                } catch (err) {
                    console.warn('Anonymous auth failed, starting listeners anyway:', err);
                    startFirestoreListeners();
                }
            }
        });

        return () => {
            unsubAuth();
            usersUnsub?.();
            requestsUnsub?.();
            threadUnsub?.();
        };
    }, [router]);

    // Subscribe to messages for selected user
    useEffect(() => {
        if (!selectedUser) return;
        const msgRef = collection(db, "admin_messages", selectedUser.id, "thread");
        const q = query(msgRef, orderBy("createdAt", "asc"));
        const unsub = onSnapshot(q, (snap) => {
            setAdminMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminMessage)));
        });
        return () => unsub();
    }, [selectedUser?.id]);


    const handleStatusMove = async (userId: string, newStatus: string, message?: string) => {
        try {
            const updateData: any = {
                status: newStatus,
                isItsVerified: newStatus === 'verified' || newStatus === 'approved',
                adminMessage: message || (newStatus === 'rejected' ? "Please review and resubmit your details." : newStatus === 'hold' ? "Your profile is currently on hold. Please wait for further instructions." : ""),
            };
            await updateDoc(doc(db, "users", userId), updateData);
            toast.success(`User moved to ${newStatus}`);
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus, adminMessage: updateData.adminMessage } : u));
            if (selectedUser?.id === userId) {
                setSelectedUser(prev => prev ? { ...prev, status: newStatus, adminMessage: updateData.adminMessage } : null);
            }

            // Auto-post a system message in the thread so user sees the notification
            if (message || newStatus === 'rejected' || newStatus === 'hold') {
                await addDoc(collection(db, "admin_messages", userId, "thread"), {
                    text: updateData.adminMessage,
                    from: 'admin',
                    createdAt: serverTimestamp(),
                });
            }

            // --- 📩 Email Notification to Candidate ---
            const targetUser = allUsers.find(u => u.id === userId);

            // 📝 Log Action in Audit Log
            await addDoc(collection(db, 'admin_audit_logs'), {
                adminId: user?.uid,
                action: 'status_change',
                targetUserId: userId,
                targetUserName: targetUser?.name || 'Unknown',
                newStatus: newStatus,
                message: updateData.adminMessage,
                timestamp: serverTimestamp()
            });

            // notificationEmail is set during onboarding for mobile-registered users
            const userEmail = targetUser?.notificationEmail || targetUser?.email || targetUser?.mobileEmail;

            if (userEmail && userEmail.includes('@')) {
                const { notifyStatusUpdate } = await import('@/lib/emailService');
                notifyStatusUpdate({
                    candidateName: targetUser?.name || 'Candidate',
                    candidateEmail: userEmail,
                    newStatus: newStatus,
                    adminMessage: updateData.adminMessage
                }).catch(e => console.error("Status email failed", e));
            }

            // --- 🔔 In-App Notification to Candidate ---
            await addDoc(collection(db, 'users', userId, 'notifications'), {
                type: 'status_update',
                title: 'PROFILE STATUS UPDATED',
                message: `Your profile status is now: ${newStatus.toUpperCase()}. ${updateData.adminMessage ? `Admin says: "${updateData.adminMessage}"` : 'Please check your dashboard for details.'}`,
                isRead: false,
                createdAt: serverTimestamp()
            });
        } catch (error: any) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status: " + error.message);
        }
    };

    const handleSendAdminMessage = async () => {
        if (!newAdminMsg.trim() || !selectedUser) return;
        try {
            await addDoc(collection(db, "admin_messages", selectedUser.id, "thread"), {
                text: newAdminMsg.trim(),
                from: 'admin',
                createdAt: serverTimestamp(),
            });
            // Also update the adminMessage field on the user doc so the banner shows
            await updateDoc(doc(db, "users", selectedUser.id), {
                adminMessage: newAdminMsg.trim(),
                hasUnreadAdminMessage: true,
            });

            // 📝 Log Action in Audit Log
            await addDoc(collection(db, 'admin_audit_logs'), {
                adminId: user?.uid,
                action: 'send_message',
                targetUserId: selectedUser.id,
                targetUserName: selectedUser.name,
                message: newAdminMsg.trim(),
                timestamp: serverTimestamp()
            });

            setNewAdminMsg("");
            toast.success("Message sent to user.");

            // Send email notification for important admin messages
            const userEmail = selectedUser.notificationEmail || selectedUser.email || selectedUser.mobileEmail;
            if (userEmail && userEmail.includes('@')) {
                const { notifyNewAdminMessage } = await import('@/lib/emailService');
                notifyNewAdminMessage({
                    candidateName: selectedUser.name,
                    candidateEmail: userEmail,
                    messageSnippet: newAdminMsg.trim()
                }).catch(e => console.error("Admin msg email failed", e));
            }

            // --- 🔔 In-App Notification to Candidate ---
            await addDoc(collection(db, 'users', selectedUser.id, 'notifications'), {
                type: 'admin_message',
                title: 'NEW ADMIN MESSAGE',
                message: newAdminMsg.trim(),
                isRead: false,
                createdAt: serverTimestamp()
            });
        } catch (e: any) {
            toast.error("Could not send message: " + e.message);
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
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-[#881337]" />
                        <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <input
                                type="text"
                                placeholder="Search candidates..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#881337] transition-all"
                            />
                        </div>
                        {user && (
                            <button onClick={async () => {
                                try {
                                    await updateDoc(doc(db, "users", user.uid), { role: 'admin' });
                                    toast.success("Admin role granted!");
                                } catch (e) { toast.error("Could not grant admin."); }
                            }} className="bg-rose-100 hover:bg-rose-200 text-[#881337] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-rose-200">
                                <Key className="w-4 h-4" /> Grant Me Admin
                            </button>
                        )}
                        <button
                            onClick={() => router.push('/admin/users')}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-blue-200"
                        >
                            <Users className="w-4 h-4" /> Registered Users
                        </button>
                        <button
                            onClick={() => router.push('/admin/broadcast')}
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-purple-200"
                        >
                            <Send className="w-4 h-4" /> Broadcast Push
                        </button>
                        <button
                            onClick={() => router.push('/admin/sms-broadcast')}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-emerald-200"
                        >
                            <Smartphone className="w-4 h-4" /> Broadcast SMS
                        </button>
                        <button
                            onClick={() => router.push('/admin/audit-logs')}
                            className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-gray-700"
                        >
                            <ShieldAlert className="w-4 h-4" /> Audit Logs
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem("admin_auth_token");
                                toast.success("Admin session terminated.");
                                router.push('/admin/login');
                            }}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors border border-gray-200"
                        >
                            <LogOut className="w-4 h-4" /> Secure Logout
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
                                        <div><p className="text-gray-500 uppercase text-[10px] font-bold">Location</p><p className="font-medium text-gray-800">{selectedUser.hizratLocation}</p></div>
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
                                                    <img src={selectedUser.itsImageUrl} alt="ITS Doc" className="w-full h-full object-contain" />
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
                                                    <img src={selectedUser.libasImageUrl} alt="Libas Photo" className="w-full h-full object-cover" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

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

                {loading ? (
                    <div className="text-center p-12 text-gray-500 font-bold animate-pulse">Scanning database...</div>
                ) : (
                    <>
                        {/* Analytics Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-3 bg-rose-50 text-[#881337] rounded-full"><BarChart3 className="w-6 h-6" /></div>
                                <div><p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Total Users</p><h2 className="text-2xl font-bold font-serif">{analytics.totalUsers}</h2></div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-3 bg-orange-50 text-orange-500 rounded-full"><Clock className="w-6 h-6" /></div>
                                <div><p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Pending</p><h2 className="text-2xl font-bold font-serif">{analytics.pendingCount}</h2></div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-3 bg-yellow-50 text-yellow-500 rounded-full"><PauseCircle className="w-6 h-6" /></div>
                                <div><p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">On Hold</p><h2 className="text-2xl font-bold font-serif">{analytics.holdCount}</h2></div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle className="w-6 h-6" /></div>
                                <div><p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Match Rate</p><h2 className="text-2xl font-bold font-serif">{analytics.acceptedRatio}%</h2></div>
                            </div>
                        </div>

                        <div className="mb-4"><h2 className="text-xl font-bold font-serif uppercase tracking-widest text-[#881337]">Profile Approval Pipeline</h2></div>

                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 hidden md:grid grid-cols-12 gap-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'name', direction: p.key === 'name' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Profile / Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'itsNumber', direction: p.key === 'itsNumber' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    ITS Number {sortConfig.key === 'itsNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </div>
                                <div className="col-span-2 cursor-pointer flex items-center gap-1 hover:text-[#881337]" onClick={() => setSortConfig(p => ({ key: 'hizratLocation', direction: p.key === 'hizratLocation' && p.direction === 'asc' ? 'desc' : 'asc' }))}>
                                    Location {sortConfig.key === 'hizratLocation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
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
                                {sortedUsers.length === 0 ? (
                                    <div className="p-10 text-center text-gray-400 font-bold uppercase text-sm">No users found</div>
                                ) : (
                                    sortedUsers.map((u) => {
                                        const now = Date.now();
                                        const createdTime = u.createdAt?.seconds ? u.createdAt.seconds * 1000 : new Date(u.createdAt || 0).getTime();
                                        const isNew = now - createdTime < 24 * 60 * 60 * 1000;
                                        const hasNewMsg = msgCounts[u.id]?.userMsgs > 0;

                                        return (
                                            <div
                                                key={u.id}
                                                className={`p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center cursor-pointer transition-colors relative ${hasNewMsg ? 'bg-blue-50/50 hover:bg-blue-100/50 border-l-4 border-blue-500' : isNew ? 'bg-amber-50/30 hover:bg-amber-100/30 border-l-4 border-amber-400' : 'hover:bg-gray-50/80'}`}
                                                onClick={() => openDetails(u)}
                                            >
                                                <div className="col-span-2 flex items-center gap-3 w-full">
                                                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-100">
                                                        {u.libasImageUrl ? <img src={u.libasImageUrl} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#881337] font-bold bg-rose-50">{u.name?.charAt(0) || '?'}</div>}
                                                    </div>
                                                    <div className="flex-1 truncate">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="font-bold text-[#881337] truncate">{u.name}</p>
                                                            {isNew && <span className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">NEW</span>}
                                                        </div>
                                                        <p className="text-[10px] text-gray-400 truncate">{u.mobile || u.mobileNumber || "No mobile"}</p>
                                                    </div>
                                                </div>
                                                <div className="col-span-2 w-full text-sm font-medium text-gray-700">{u.itsNumber}</div>
                                                <div className="col-span-2 w-full text-sm text-gray-500 truncate">{u.hizratLocation || 'N/A'}</div>
                                                <div className="col-span-2 w-full">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(u.status)}`}>{getStatusLabel(u.status)}</span>
                                                </div>
                                                <div className="col-span-2 w-full flex flex-col items-start gap-1">
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                        {u.createdAt ? (new Date(createdTime).toLocaleDateString()) : 'N/A'}
                                                    </p>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); openDetails(u, 'messages'); }}
                                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all text-[10px] font-bold border ${hasNewMsg ? 'bg-blue-100 text-blue-700 border-blue-200 shadow-sm' : 'text-[#881337] hover:bg-rose-50 border-transparent hover:border-rose-100'}`}
                                                    >
                                                        <MessageCircle className={`w-3.5 h-3.5 ${hasNewMsg ? 'animate-bounce' : ''}`} />
                                                        <span>{hasNewMsg ? 'New Message' : 'View Chat'}</span>
                                                        {msgCounts[u.id] && (
                                                            <span className={`ml-1 px-1.5 py-0.5 rounded-full border ${hasNewMsg ? 'bg-blue-200 border-blue-300' : 'bg-rose-100 border-rose-200'}`}>
                                                                {msgCounts[u.id].userMsgs}/{msgCounts[u.id].total}
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="col-span-2 w-full flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button onClick={() => openDetails(u)} className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 shadow-sm transition-colors" title="Open Complete Details"><ArrowRight className="w-4 h-4" /></button>
                                                    {(!u.status || u.status === 'pending_verification' || u.status === 'pending') && (
                                                        <button onClick={() => handleStatusMove(u.id, 'verified')} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 shadow-sm" title="Quick Verify"><CheckCircle className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
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
