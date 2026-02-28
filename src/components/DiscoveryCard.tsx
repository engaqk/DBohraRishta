"use client";
import React, { useState, useEffect } from 'react';
import { Info, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface DiscoveryCardProps {
    id: string; // The target user's ID
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    hizratLocation?: string;
    itsImageUrl?: string;
    libasImageUrl?: string;
    matchScore?: number;
    isMyProfileVerified?: boolean;
}

export default function DiscoveryCard({ id, name, dob, jamaat, education, hizratLocation, libasImageUrl, matchScore = 85, isMyProfileVerified = false }: DiscoveryCardProps) {
    const { user } = useAuth();
    const [requestSent, setRequestSent] = useState(false);
    const [loading, setLoading] = useState(false);

    // Calculate approximate age
    const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / 31557600000) : 25;

    // Check if request already sent
    useEffect(() => {
        const checkExistingRequest = async () => {
            if (!user) return;
            const q = query(
                collection(db, "rishta_requests"),
                where("from", "==", user.uid),
                where("to", "==", id)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                setRequestSent(true);
            }
        };
        checkExistingRequest();
    }, [user, id]);

    const handleSendRequest = async () => {
        if (!user) {
            toast.error("You must be logged in to send a request");
            return;
        }

        if (!isMyProfileVerified) {
            toast.error("Your profile must be approved by an Admin before sending Rishta requests.");
            return;
        }

        try {
            setLoading(true);
            await addDoc(collection(db, "rishta_requests"), {
                from: user.uid,
                to: id,
                status: "pending_response",
                timestamp: serverTimestamp()
            });
            setRequestSent(true);
            toast.success("Rishta Request sent successfully!");
        } catch (error: any) {
            toast.error("Failed to send request: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-[#F9FAFB] rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-sm w-full transition-transform hover:scale-[1.02] flex flex-col">
            {/* Blurred Photo Placeholder */}
            <div className="relative h-72 bg-gray-200 flex items-center justify-center overflow-hidden">
                {libasImageUrl && (
                    <img src={libasImageUrl} alt="Profile" className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-60" />
                )}
                <div className="absolute inset-0 bg-gradient-to-br from-[#881337] to-[#D4AF37] blur-3xl opacity-20"></div>
                <div className="z-10 flex flex-col items-center bg-white/60 p-5 rounded-2xl backdrop-blur-md border border-white/40 shadow-sm text-center">
                    <ShieldCheck className="w-10 h-10 text-[#881337] mb-2" />
                    <span className="text-md font-bold text-[#881337] leading-tight flex flex-col gap-1">
                        <span>Dynamic Privacy</span>
                        <span className="text-xs font-normal text-[#881337]/80 max-w-[120px]">Unblurs after accepted Rishta Request</span>
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-[#881337] font-serif">{name || 'Verified Member'}, {age}</h3>
                        <p className="text-gray-600 font-sans text-sm mt-1">{jamaat || 'Community Member'} • {hizratLocation || 'Unknown'}</p>
                    </div>
                    <div className="bg-[#881337] text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-md">
                        <span>{matchScore}% Match</span>
                    </div>
                </div>

                <div className="space-y-3 mb-6 flex-grow">
                    <div className="flex items-center text-sm">
                        <CheckCircle className="w-5 h-5 text-[#D4AF37] mr-3" />
                        <span className="text-gray-700 font-medium">ITS Verified Profile</span>
                    </div>
                    <div className="flex items-center text-sm">
                        <Info className="w-5 h-5 text-[#D4AF37] mr-3" />
                        <span className="text-gray-700">{education || 'Graduated'}</span>
                    </div>
                </div>

                <button
                    onClick={handleSendRequest}
                    disabled={requestSent || loading || !isMyProfileVerified}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 
                    ${!isMyProfileVerified ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200' :
                            requestSent ? 'bg-gray-100 text-[#881337] cursor-not-allowed border border-gray-200 shadow-none' :
                                'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg'}`}
                >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {!isMyProfileVerified ? 'Awaiting Verification' : requestSent ? 'Request Sent' : 'Send Request'}
                </button>
            </div>
        </div>
    );
}
