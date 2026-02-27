"use client";
import React, { useState } from 'react';
import { CameraOff, Info, CheckCircle, ShieldCheck } from 'lucide-react';

interface DiscoveryCardProps {
    name: string;
    age: number;
    jamaat: string;
    education: string;
    location: string;
    matchScore: number;
}

export default function DiscoveryCard({ name, age, jamaat, education, location, matchScore }: DiscoveryCardProps) {
    const [requestSent, setRequestSent] = useState(false);

    return (
        <div className="bg-[#F9FAFB] rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-sm w-full transition-transform hover:scale-[1.02] flex flex-col">
            {/* Blurred Photo Placeholder */}
            <div className="relative h-72 bg-gray-200 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#064E3B] to-[#D4AF37] blur-3xl opacity-20"></div>
                <div className="z-10 flex flex-col items-center bg-white/60 p-5 rounded-2xl backdrop-blur-md border border-white/40 shadow-sm text-center">
                    <ShieldCheck className="w-10 h-10 text-[#064E3B] mb-2" />
                    <span className="text-md font-bold text-[#064E3B] leading-tight flex flex-col gap-1">
                        <span>Dynamic Privacy</span>
                        <span className="text-xs font-normal text-[#064E3B]/80 max-w-[120px]">Unblurs after accepted Nisbat Request</span>
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-2xl font-bold text-[#064E3B] font-serif">{name}, {age}</h3>
                        <p className="text-gray-600 font-sans text-sm mt-1">{jamaat} • {location}</p>
                    </div>
                    <div className="bg-[#064E3B] text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-md">
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
                        <span className="text-gray-700">{education}</span>
                    </div>
                </div>

                <button
                    onClick={() => setRequestSent(true)}
                    disabled={requestSent}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${requestSent ? 'bg-gray-100 text-[#064E3B] cursor-not-allowed border border-gray-200' : 'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg'}`}
                >
                    {requestSent ? 'Nisbat Request Sent' : 'Send Nisbat Request'}
                </button>
            </div>
        </div>
    );
}
