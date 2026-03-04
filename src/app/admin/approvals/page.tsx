"use client";

import React, { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ShieldAlert, CheckCircle, XCircle, BarChart3, Clock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

interface PendingUser {
    id: string;
    name: string;
    itsNumber: string;
    jamaat: string;
    itsImageUrl: string | null;
    libasImageUrl: string | null;
    status: string;
    hizratLocation: string;
    mobileNumber?: string; // optional mobile number field
    [key: string]: any; // Catch-all for full biodata
}

export default function AdminVerificationPage() {
    const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [analytics, setAnalytics] = useState({ totalUsers: 0, acceptedRatio: 0, cities: {} as any });

    useEffect(() => {
        fetchAdminData();
    }, []);

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
            let accepted = 0;
            let total = 0;
            rSnap.forEach(r => {
                total++;
                if (r.data().status === 'accepted') accepted++;
            });

            setAnalytics({
                totalUsers: usersList.length,
                acceptedRatio: total > 0 ? Math.round((accepted / total) * 100) : 0,
                cities: citiesCount
            });

        } catch (error: any) {
            toast.error("Failed to fetch data: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusMove = async (userId: string, newStatus: string, message?: string) => {
        console.log('handleStatusMove called', { userId, newStatus, message });
        try {
            const updateData: any = {
                status: newStatus,
                isItsVerified: newStatus === 'verified' || newStatus === 'approved'
            };

            if (newStatus === 'rejected') {
                updateData.adminMessage = message || "Please review and resubmit your details.";
            }

            await updateDoc(doc(db, "users", userId), updateData);
            toast.success(`User moved to ${newStatus}`);
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    // Open and close detail modal
    const openDetails = (user: PendingUser) => {
        setSelectedUser(user);
        setShowRejectInput(false);
        setRejectReason("");
    };
    const closeDetails = () => {
        setSelectedUser(null);
        setShowRejectInput(false);
        setRejectReason("");
    };



    const getStatusColor = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'under_review' || status === 'pending') {
            return 'bg-orange-50 text-orange-700 border-orange-200';
        }
        if (status === 'verified' || status === 'approved') {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        if (status === 'rejected') {
            return 'bg-rose-50 text-rose-700 border-rose-200';
        }
        return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getStatusLabel = (status: string) => {
        if (!status || status === 'pending_verification' || status === 'pending') return 'Pending Verification';
        if (status === 'under_review') return 'Under Review';
        if (status === 'verified') return 'Verified';
        if (status === 'approved') return 'Approved';
        if (status === 'rejected') return 'Rejected';
        return status;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-[1400px] w-full mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldAlert className="w-8 h-8 text-[#881337]" />
                    <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
                </div>
                {/* Detail Modal */}
                {selectedUser && (
                    <dialog open className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="bg-white rounded-lg p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-4 text-[#881337] border-b pb-2">User Profile: {selectedUser.name}</h2>
                            <div className="grid grid-cols-2 gap-4 mb-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-64 overflow-y-auto">
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">ITS Number</p><p className="font-medium text-[#881337]">{selectedUser.itsNumber}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">DOB</p><p className="font-medium text-gray-800">{selectedUser.dob || "N/A"}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Gender & Height</p><p className="font-medium text-gray-800 capitalize">{selectedUser.gender || "N/A"} • {selectedUser.heightFeet ? `${selectedUser.heightFeet}' ${selectedUser.heightInch}"` : "N/A"}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Marital Status</p><p className="font-medium text-gray-800 capitalize">{selectedUser.maritalStatus || "Single"}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Jamaat</p><p className="font-medium text-gray-800">{selectedUser.jamaat}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Location</p><p className="font-medium text-gray-800">{selectedUser.hizratLocation}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Mobile</p><p className="font-medium text-gray-800">{selectedUser.mobile || selectedUser.mobileNumber || "Not set"}</p></div>
                                <div><p className="text-gray-500 uppercase text-[10px] font-bold">Email</p><p className="font-medium text-gray-800">{selectedUser.email || "Not set"}</p></div>
                                <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Education</p><p className="font-medium text-gray-800">{selectedUser.education || selectedUser.completedUpto || "N/A"} - {selectedUser.educationDetails || "No details"}</p></div>
                                <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Profession</p><p className="font-medium text-gray-800">{selectedUser.professionType || "N/A"} - {selectedUser.serviceType || "N/A"}</p></div>
                                <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Parents</p><p className="font-medium text-gray-800 text-xs">Father: {selectedUser.fatherName || "N/A"} | Mother: {selectedUser.motherName || "N/A"}</p></div>
                                <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Bio</p><p className="font-medium text-gray-800 italic">{selectedUser.bio || "None"}</p></div>
                                <div className="col-span-2"><p className="text-gray-500 uppercase text-[10px] font-bold">Partner Qualities</p><p className="font-medium text-gray-800 text-xs">{selectedUser.partnerQualities || "None"}</p></div>
                            </div>

                            <div className="flex gap-4 mb-6">
                                {selectedUser.itsImageUrl && (
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-500 mb-1">ITS Card</p>
                                        <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                                            <img src={selectedUser.itsImageUrl} alt="ITS Doc" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                )}
                                {selectedUser.libasImageUrl && (
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-gray-500 mb-1">Libas Photo</p>
                                        <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                                            <img src={selectedUser.libasImageUrl} alt="Libas Photo" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-3 justify-end border-t pt-4 mt-4">
                                <h4 className="font-bold text-[#881337] text-sm">Admin Comment / Message (Optional)</h4>
                                <p className="text-xs text-gray-500 mb-1">Send a message to the user along with rejection or verification. If rejected, they must fix and resubmit for reverification.</p>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="e.g. Please update your Libas photo with a clearer version."
                                    className="w-full p-3 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#881337] resize-none h-20"
                                />
                                <div className="flex gap-3 justify-end w-full mt-2">
                                    {selectedUser.status !== 'approved' && selectedUser.status !== 'verified' && (
                                        <button onClick={() => { handleStatusMove(selectedUser.id, 'verified', rejectReason); closeDetails(); }} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm">Verify / Accept</button>
                                    )}
                                    {selectedUser.status === 'verified' && (
                                        <button onClick={() => { handleStatusMove(selectedUser.id, 'approved', rejectReason); closeDetails(); }} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm">Final Approve</button>
                                    )}
                                    {selectedUser.status !== 'rejected' && (
                                        <button onClick={() => { handleStatusMove(selectedUser.id, 'rejected', rejectReason); closeDetails(); }} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm">Reject Profile</button>
                                    )}
                                    <button onClick={closeDetails} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 rounded-xl transition-colors">Close</button>
                                </div>
                            </div>
                        </div>
                    </dialog>
                )}


                {loading ? (
                    <div className="text-center p-12 text-gray-500 font-bold animate-pulse">Scanning database...</div>
                ) : (
                    <>
                        {/* Analytics Top Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6">
                                <div className="p-4 bg-rose-50 text-[#881337] rounded-full shrink-0"><BarChart3 className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-1">Total Network</p>
                                    <h2 className="text-3xl font-bold font-serif">{analytics.totalUsers} <span className="text-sm font-sans text-gray-500 font-normal">Registered</span></h2>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6">
                                <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full shrink-0"><CheckCircle className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-1">Match Success</p>
                                    <h2 className="text-3xl font-bold font-serif">{analytics.acceptedRatio}% <span className="text-sm font-sans text-gray-500 font-normal">Acceptance Rate</span></h2>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-6">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-full shrink-0"><Clock className="w-8 h-8" /></div>
                                <div>
                                    <p className="text-xs uppercase font-bold text-gray-400 tracking-widest mb-1">Avg Match Time</p>
                                    <h2 className="text-3xl font-bold font-serif">3.4 <span className="text-sm font-sans text-gray-500 font-normal">Days (Est)</span></h2>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold font-serif uppercase tracking-widest text-[#881337]">Profile Approval Pipeline</h2>
                        </div>

                        {/* Unified List / Row Grid */}
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
                                    allUsers.map((user) => (
                                        <div key={user.id} className={`p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-center transition-colors hover:bg-gray-50/50 ${getStatusColor(user.status).replace('text-', 'hover:border-').replace('border-', 'border-l-4 border-l-')}`}>
                                            <div className="col-span-3 flex items-center gap-3 w-full">
                                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                                                    {user.libasImageUrl ? (
                                                        <img src={user.libasImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[#881337] font-bold bg-rose-50 border border-rose-100">
                                                            {user.name?.charAt(0) || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 truncate">
                                                    <p className="font-bold text-[#881337] truncate">{user.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{user.mobileNumber || "No mobile"}</p>
                                                </div>
                                            </div>
                                            <div className="col-span-2 w-full text-sm font-medium text-gray-700">
                                                {user.itsNumber}
                                            </div>
                                            <div className="col-span-2 w-full text-sm text-gray-500 truncate">
                                                {user.hizratLocation || 'N/A'}
                                            </div>
                                            <div className="col-span-2 w-full">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(user.status)}`}>
                                                    {getStatusLabel(user.status)}
                                                </span>
                                            </div>
                                            <div className="col-span-3 w-full flex items-center justify-end gap-2">
                                                <button onClick={() => openDetails(user)} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 shadow-sm transition-colors">
                                                    View Bio & Photos
                                                </button>
                                                {(!user.status || user.status === 'pending_verification' || user.status === 'pending') && (
                                                    <button onClick={() => handleStatusMove(user.id, 'verified')} className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg hover:bg-emerald-100 shadow-sm" title="Quick Verify">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {(user.status === 'verified') && (
                                                    <button onClick={() => handleStatusMove(user.id, 'approved')} className="p-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg hover:bg-indigo-100 shadow-sm" title="Quick Approve">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
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

