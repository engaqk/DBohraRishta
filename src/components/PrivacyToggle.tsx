"use client";
import React, { useState } from 'react';
import { Shield, EyeOff, Lock, Eye } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';

export default function PrivacyToggle({ isBlurSecurityEnabled = true }: { isBlurSecurityEnabled?: boolean }) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const togglePrivacy = async () => {
        if (!user) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                isBlurSecurityEnabled: !isBlurSecurityEnabled
            });
            toast.success(!isBlurSecurityEnabled ? "Photo Blur Enabled" : "Photo Blur Disabled");
        } catch (error: any) {
            toast.error("Failed to update privacy settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <Shield className="w-6 h-6 text-[#881337] mr-2" />
                    <h3 className="text-lg font-bold text-[#881337] font-serif">dBohra Match Privacy</h3>
                </div>
                <button
                    onClick={togglePrivacy}
                    disabled={loading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${isBlurSecurityEnabled ? 'bg-[#881337]' : 'bg-gray-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isBlurSecurityEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                {isBlurSecurityEnabled ? "Your photos are currently blurred to everyone until you accept a Rishta Request." : "Your photos are visible to all verified members. (Not Recommended)"}
            </p>

            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 flex flex-col gap-2 border border-gray-100">
                <div className="flex items-center">{isBlurSecurityEnabled ? <EyeOff className="w-4 h-4 mr-2 text-[#D4AF37]" /> : <Eye className="w-4 h-4 mr-2 text-gray-400" />} {isBlurSecurityEnabled ? "Dynamic Photo Blur Active" : "Dynamic Photo Blur Inactive"}</div>
                <div className="flex items-center"><Lock className="w-4 h-4 mr-2 text-[#D4AF37]" /> Screenshot Prevention Active</div>
            </div>
        </div>
    );
}
