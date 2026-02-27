"use client";
import React, { useState } from 'react';
import { Shield, EyeOff, Lock } from 'lucide-react';

export default function PrivacyToggle() {
    const [isPrivate, setIsPrivate] = useState(true);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <Shield className="w-6 h-6 text-[#881337] mr-2" />
                    <h3 className="text-lg font-bold text-[#881337] font-serif">Bohri Cupid+ Privacy</h3>
                </div>
                <button
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isPrivate ? 'bg-[#881337]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPrivate ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                {isPrivate ? "Your photos are currently blurred to everyone until you accept a Nisbat Request." : "Your photos are visible to all verified members. (Not Recommended)"}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 flex flex-col gap-2 border border-gray-100">
                <div className="flex items-center"><EyeOff className="w-4 h-4 mr-2 text-[#D4AF37]" /> Dynamic Photo Blur Active</div>
                <div className="flex items-center"><Lock className="w-4 h-4 mr-2 text-[#D4AF37]" /> Screenshot Prevention Active</div>
            </div>
        </div>
    );
}
