"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc, onSnapshot, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ShieldAlert, CheckCircle, XCircle, BarChart3, Clock, ArrowRight, Key, MessageCircle, Send, PauseCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
    const [analytics, setAnalytics] = useState({ totalUsers: 0, acceptedRatio: 0, pendingCount: 0, holdCount: 0 });
    const [adminMessages, setAdminMessages] = useState<AdminMessage[]>([]);
    const [newAdminMsg, setNewAdminMsg] = useState("");
    const [activeDetailTab, setActiveDetailTab] = useState<'biodata' | 'messages'>('biodata');
    const { user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const isAdmin = localStorage.getItem("admin_auth_token");
        if (!isAdmin) {
            router.push('/admin/login');
            return;
        }
        fetchAdminData();
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

    const fetchAdminData = async () => {
        try {
            setLoading(true);
            const usersQ = query(collection(db, "users"));
            const uSnap = await getDocs(usersQ);

            const usersList: PendingUser[] = [];
            let citiesCount: any = {};

            uSnap.forEach((doc) => {
                const u = { id: doc.id, ...doc.data() } as PendingUser;
                usersList.push(u);
                if (u.hizratLocation) {
                    citiesCount[u.hizratLocation] = (citiesCount[u.hizratLocation] || 0) + 1;
                }
            });

            setAllUsers(usersList);

            const reqQ = query(collection(db, "rishta_requests"));
            const rSnap = await getDocs(reqQ);
            let accepted = 0; let total = 0;
            rSnap.forEach(r => { total++; if (r.data().status === 'accepted') accepted++; });

            setAnalytics({
                totalUsers: usersList.length,
                acceptedRatio: total > 0 ? Math.round((accepted / total) * 100) : 0,
                pendingCount: usersList.filter(u => !u.status || u.status === 'pending' || u.status === 'pending_verification').length,
                holdCount: usersList.filter(u => u.status === 'hold').length,
            });

        } catch (error: any) {
            toast.error("Failed to fetch data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

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
            setNewAdminMsg("");
            toast.success("Message sent to user.");
        } catch (e: any) {
            toast.error("Could not send message: " + e.message);
        }
    };

    const openDetails = (u: PendingUser) => {
        setSelectedUser(u);
        setAdminComment(u.adminMessage || "");
        setActiveDetailTab('biodata');
    };
    const closeDetails = () => { setSelectedUser(null); setAdminComment(""); };

    const getStatusColor = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'pending') return 'bg-orange-50 text-orange-700 border-orange-200';
        if (status === 'verified' || status === 'approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'rejected') return 'bg-rose-50 text-rose-700 border-rose-200';
        if (status === 'hold') return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getStatusLabel = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'pending') return 'Pending Verification';
        if (status === 'under_review') return 'Under Review';
        if (status === 'verified') return 'Verified';
        if (status === 'approved') return 'Approved';
        if (status === 'rejected') return 'Rejected';
        if (status === 'hold') return '⏸ On Hold';
        return status;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-[1400px] w-full mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="w-8 h-8 text-[#881337]" />
                        <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
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
                            {/* Detail Tabs */}
                            <div className="flex gap-2">
                                <button onClick={() => setActiveDetailTab('biodata')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${activeDetailTab === 'biodata' ? 'bg-[#881337] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Biodata</button>
                                <button onClick={() => setActiveDetailTab('messages')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeDetailTab === 'messages' ? 'bg-[#881337] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                    <MessageCircle className="w-3.5 h-3.5" /> Messages {adminMessages.length > 0 && <span className="bg-rose-500 text-white rounded-full px-1.5 text-[9px]">{adminMessages.length}</span>}
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
                                            <div className="flex-1"><p className="text-xs font-bold text-gray-500 mb-1">ITS Card</p><div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200"><img src={selectedUser.itsImageUrl} alt="ITS Doc" className="w-full h-full object-cover" /></div></div>
                                        )}
                                        {selectedUser.libasImageUrl && (
                                            <div className="flex-1"><p className="text-xs font-bold text-gray-500 mb-1">Libas Photo</p><div className="w-full h-40 bg-gray-100 rounded-xl overflow-hidden border border-gray-200"><img src={selectedUser.libasImageUrl} alt="Libas Photo" className="w-full h-full object-cover" /></div></div>
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
                                <div className="col-span-3">Profile / Name</div>
                                <div className="col-span-2">ITS Number</div>
                                <div className="col-span-2">Location</div>
                                <div className="col-span-2">Status</div>
                                <div className="col-span-3 text-right">Actions</div>
                            </div>
                            <div className="divide-y divide-gray-100">
                                {allUsers.length === 0 ? (
                                    <div className="p-10 text-center text-gray-400 font-bold uppercase text-sm">No users found</div>
                                ) : (
                                    allUsers.map((u) => (
                                        <div key={u.id} onClick={() => openDetails(u)} className="p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center cursor-pointer transition-colors hover:bg-gray-50/80">
                                            <div className="col-span-3 flex items-center gap-3 w-full">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-100">
                                                    {u.libasImageUrl ? <img src={u.libasImageUrl} alt="Profile" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#881337] font-bold bg-rose-50">{u.name?.charAt(0) || '?'}</div>}
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <p className="font-bold text-[#881337] truncate">{u.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{u.mobile || u.mobileNumber || "No mobile"}</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 w-full text-sm font-medium text-gray-700">{u.itsNumber}</div>
                                            <div className="col-span-2 w-full text-sm text-gray-500 truncate">{u.hizratLocation || 'N/A'}</div>
                                            <div className="col-span-2 w-full">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(u.status)}`}>{getStatusLabel(u.status)}</span>
                                            </div>
                                            <div className="col-span-3 w-full flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => openDetails(u)} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 shadow-sm transition-colors">Open Details</button>
                                                {(!u.status || u.status === 'pending_verification' || u.status === 'pending') && (
                                                    <button onClick={() => handleStatusMove(u.id, 'verified')} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 shadow-sm" title="Quick Verify"><CheckCircle className="w-4 h-4" /></button>
                                                )}
                                                {u.status !== 'rejected' && (
                                                    <button onClick={() => handleStatusMove(u.id, 'hold', 'Your profile has been put on hold temporarily.')} className="p-2 bg-yellow-50 text-yellow-600 border border-yellow-100 rounded-lg hover:bg-yellow-100 shadow-sm" title="Put on Hold"><PauseCircle className="w-4 h-4" /></button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
