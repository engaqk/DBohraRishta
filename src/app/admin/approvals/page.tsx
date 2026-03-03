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
}

export default function AdminVerificationPage() {
    const [allUsers, setAllUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);
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

    const handleStatusMove = async (userId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "users", userId), {
                status: newStatus,
                isItsVerified: newStatus === 'verified'
            });
            toast.success(`User moved to ${newStatus}`);
            setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        } catch (error: any) {
            toast.error("Failed to update status");
        }
    };

    const renderColumn = (title: string, matchStatus: string) => {
        const columnUsers = allUsers.filter(u => u.status === matchStatus || (matchStatus === 'pending_verification' && !u.status));
        return (
            <div className="bg-[#F9FAFB] rounded-3xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
                <div className="p-5 border-b border-gray-200/50 bg-white rounded-t-3xl">
                    <h3 className="font-bold text-[#881337] uppercase tracking-wider text-xs flex justify-between items-center">
                        {title}
                        <span className="bg-[#881337] text-white px-2.5 py-1 rounded-full text-[10px]">{columnUsers.length}</span>
                    </h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {columnUsers.map(user => (
                        <div key={user.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm relative group overflow-hidden">
                            <h4 className="font-bold text-[#881337] text-sm mb-1 truncate">{user.name}</h4>
                            <p className="text-xs text-gray-500 font-medium mb-4 truncate">ITS: {user.itsNumber} • {user.jamaat}</p>
                            <div className="flex gap-2 text-xs">
                                {matchStatus === 'pending_verification' && (
                                    <button onClick={() => handleStatusMove(user.id, 'under_review')} className="flex-1 bg-amber-50 text-amber-700 font-bold py-2.5 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors shadow-sm">Review Docs</button>
                                )}
                                {matchStatus === 'under_review' && (
                                    <>
                                        <button onClick={() => handleStatusMove(user.id, 'verified')} className="flex-1 bg-emerald-50 text-emerald-700 font-bold py-2.5 rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors shadow-sm flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> </button>
                                        <button onClick={() => handleStatusMove(user.id, 'rejected')} className="flex-1 bg-rose-50 text-rose-700 font-bold py-2.5 rounded-xl border border-rose-100 hover:bg-rose-100 transition-colors shadow-sm flex items-center justify-center gap-1"><XCircle className="w-3.5 h-3.5" /> </button>
                                    </>
                                )}
                                {(matchStatus === 'verified' || matchStatus === 'rejected') && (
                                    <div className={`w-full text-center py-2.5 rounded-xl font-bold uppercase tracking-wider text-[10px] ${matchStatus === 'verified' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                                        {matchStatus}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {columnUsers.length === 0 && (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold uppercase p-10 text-center">Empty</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-6 text-[#881337] pt-12 md:px-12">
            <div className="max-w-[1400px] w-full mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldAlert className="w-8 h-8 text-[#881337]" />
                    <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
                </div>

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

                        {/* Kanban Board */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-stretch">
                            {renderColumn("📥 Incoming", "pending_verification")}
                            {renderColumn("🔍 Under Review", "under_review")}
                            {renderColumn("✅ Verified", "verified")}
                            {renderColumn("🚫 Rejected", "rejected")}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

