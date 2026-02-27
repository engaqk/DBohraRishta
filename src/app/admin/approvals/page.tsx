"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { ShieldAlert, CheckCircle, XCircle } from "lucide-react";
import toast from "react-hot-toast";

interface PendingUser {
    id: string;
    name: string;
    itsNumber: string;
    jamaat: string;
    itsImageUrl: string | null;
    libasImageUrl: string | null;
    status: string;
}

export default function AdminVerificationPage() {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [loading, setLoading] = useState(true);

    // Note: Standard security practice says we should evaluate custom claims (like isAdmin: true) 
    // before displaying this page, but for prototyping/testing, we'll bypass to show functionality.

    useEffect(() => {
        fetchPendingVerifications();
    }, []);

    const fetchPendingVerifications = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, "users"), where("status", "==", "pending_verification"));
            const querySnapshot = await getDocs(q);

            const users: PendingUser[] = [];
            querySnapshot.forEach((doc) => {
                users.push({ id: doc.id, ...doc.data() } as PendingUser);
            });

            setPendingUsers(users);
        } catch (error: any) {
            toast.error("Failed to fetch pending verifications: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerification = async (userId: string, isApproved: boolean) => {
        try {
            const userRef = doc(db, "users", userId);

            await updateDoc(userRef, {
                isItsVerified: isApproved,
                status: isApproved ? "verified" : "rejected"
            });

            toast.success(`User successfully ${isApproved ? 'approved' : 'rejected'}!`);
            // Remove the user from the local state list to update UI instantly without another read
            setPendingUsers(prev => prev.filter(user => user.id !== userId));

        } catch (error: any) {
            toast.error("Action failed: " + error.message);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 text-[#881337] pt-12">
            <div className="max-w-4xl w-full">
                <div className="flex items-center gap-3 mb-8">
                    <ShieldAlert className="w-8 h-8 text-red-600" />
                    <h1 className="text-3xl font-bold font-serif text-gray-900">Admin Panel: ITS Verification</h1>
                </div>

                {loading ? (
                    <div className="text-center p-12 text-gray-500 font-bold animate-pulse">Scanning database...</div>
                ) : pendingUsers.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl shadow-sm border border-gray-100 text-center flex flex-col items-center gap-4">
                        <CheckCircle className="w-16 h-16 text-rose-500" />
                        <p className="text-xl font-bold text-gray-700">All caught up!</p>
                        <p className="text-gray-500">There are no pending ITS verifications right now.</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {pendingUsers.map((user) => (
                            <div key={user.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-6 flex flex-col md:flex-row gap-8 items-start">

                                {/* ID Card Display */}
                                <div className="w-full md:w-1/3 flex flex-col gap-2">
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">Captured ITS Card</h3>
                                    {user.itsImageUrl ? (
                                        <div className="relative aspect-[1.58] w-full rounded-xl overflow-hidden shadow-inner border-2 border-gray-100 bg-gray-100 flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={user.itsImageUrl} alt="ITS Card" className="object-contain w-full h-full" />
                                        </div>
                                    ) : (
                                        <div className="aspect-[1.58] w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-400">
                                            No Image Uploaded
                                        </div>
                                    )}
                                    <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400 mt-4">Qaumi Libas Photo</h3>
                                    {user.libasImageUrl ? (
                                        <div className="relative aspect-[1] w-full max-w-[200px] mx-auto rounded-xl overflow-hidden shadow-inner border-2 border-gray-100 bg-gray-100 flex items-center justify-center">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={user.libasImageUrl} alt="Libas Photo" className="object-cover w-full h-full" />
                                        </div>
                                    ) : (
                                        <div className="aspect-[1] w-full max-w-[200px] mx-auto rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-400 text-center p-4">
                                            No Libas Photo
                                        </div>
                                    )}
                                </div>

                                {/* User Data & Actions */}
                                <div className="w-full md:w-2/3 flex flex-col h-full justify-between">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-8 mb-6">
                                        <div>
                                            <p className="text-xs uppercase font-bold text-gray-400">Given Name</p>
                                            <p className="text-lg font-bold font-serif">{user.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-gray-400">ITS Number</p>
                                            <p className="text-lg font-bold font-serif text-[#D4AF37]">{user.itsNumber || 'N/A'}</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs uppercase font-bold text-gray-400">Jamaat</p>
                                            <p className="font-medium text-gray-700">{user.jamaat || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 border-t border-gray-100 pt-6 mt-auto">
                                        <button
                                            onClick={() => handleVerification(user.id, false)}
                                            className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors border border-red-100"
                                        >
                                            <XCircle className="w-5 h-5" /> Reject
                                        </button>
                                        <button
                                            onClick={() => handleVerification(user.id, true)}
                                            className="flex-1 py-3 bg-[#881337] text-white hover:bg-[#9F1239] font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md shadow-rose-900/10"
                                        >
                                            <CheckCircle className="w-5 h-5" /> Approve & Verify
                                        </button>
                                    </div>
                                </div>

                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
