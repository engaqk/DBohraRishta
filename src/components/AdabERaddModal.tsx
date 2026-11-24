"use client";
import React, { useState } from 'react';
import { HeartHandshake, ShieldCheck, X, Send, Sparkles } from 'lucide-react';

interface AdabERaddModalProps {
    isOpen: boolean;
    requesterName: string;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void> | void;
    isSubmitting?: boolean;
}

export const ADAB_PRESET_RESPONSES = [
    {
        id: 'dua',
        title: 'Universal Deeni Dua (Recommended)',
        text: "JazakAllah for your interest. May Allah Ta'ala bless the candidate with a noble match by Aqa Maula's TUS Dua Mubarak.",
        icon: '🕊️'
    },
    {
        id: 'preference',
        title: 'Family Preferences (Location / Age)',
        text: "Shukran for considering our profile. Due to family preferences regarding location/age, we are unable to proceed. Dua for best rishta.",
        icon: '🤲'
    },
    {
        id: 'in_talks',
        title: 'In Active Talks with Another Proposal',
        text: "JazakAllah Khair. We are currently actively in talks with another proposal. May Maula TUS grant you every success.",
        icon: '💐'
    }
];

export default function AdabERaddModal({
    isOpen,
    requesterName,
    onClose,
    onConfirm,
    isSubmitting = false
}: AdabERaddModalProps) {
    const [selectedOption, setSelectedOption] = useState<string>('dua');
    const [customText, setCustomText] = useState<string>('');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        let finalReason = '';
        if (selectedOption === 'custom') {
            finalReason = customText.trim() || ADAB_PRESET_RESPONSES[0].text;
        } else {
            const found = ADAB_PRESET_RESPONSES.find(r => r.id === selectedOption);
            finalReason = found ? found.text : ADAB_PRESET_RESPONSES[0].text;
        }
        await onConfirm(finalReason);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
                className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header with Bohra aesthetic */}
                <div className="bg-gradient-to-r from-[#881337] via-[#9F1239] to-[#881337] text-white p-5 sm:p-6 relative">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2.5 text-amber-300 text-xs font-bold tracking-wider uppercase mb-1">
                        <HeartHandshake className="w-4 h-4" />
                        <span>Adab-e-Radd • Dignified Closure</span>
                    </div>
                    <h3 className="text-xl font-bold font-serif text-white">
                        Respectful Community Response
                    </h3>
                    <p className="text-rose-100 text-xs mt-1 leading-relaxed">
                        In the spirit of Bohra brotherhood (Ikhwat), we send a polite and dignified message to <strong>{requesterName}</strong> instead of cold ghosting.
                    </p>
                </div>

                {/* Body */}
                <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Choose a Dignified Response:
                    </p>

                    <div className="space-y-2.5">
                        {ADAB_PRESET_RESPONSES.map((preset) => {
                            const isSelected = selectedOption === preset.id;
                            return (
                                <div
                                    key={preset.id}
                                    onClick={() => setSelectedOption(preset.id)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                                        isSelected 
                                            ? 'border-[#881337] bg-rose-50/60 shadow-xs' 
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="text-xl shrink-0 mt-0.5">{preset.icon}</div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-xs font-bold ${isSelected ? 'text-[#881337]' : 'text-gray-800'}`}>
                                                {preset.title}
                                            </p>
                                            {isSelected && (
                                                <span className="text-[10px] bg-[#881337] text-white px-2 py-0.5 rounded-full font-bold">
                                                    Selected
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1 italic font-medium leading-relaxed">
                                            &ldquo;{preset.text}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Custom Option */}
                        <div
                            onClick={() => setSelectedOption('custom')}
                            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                                selectedOption === 'custom' 
                                    ? 'border-[#881337] bg-rose-50/60 shadow-xs' 
                                    : 'border-gray-100 hover:border-gray-200 bg-white'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-lg">✍️</span>
                                <p className={`text-xs font-bold ${selectedOption === 'custom' ? 'text-[#881337]' : 'text-gray-800'}`}>
                                    Write a Custom Polite Message
                                </p>
                            </div>
                            {selectedOption === 'custom' && (
                                <textarea
                                    value={customText}
                                    onChange={(e) => setCustomText(e.target.value)}
                                    placeholder="Write a courteous deeni message wishing them well..."
                                    rows={3}
                                    className="w-full mt-2 text-xs p-3 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-[#881337] bg-white"
                                />
                            )}
                        </div>
                    </div>

                    <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-amber-900 text-[11px] leading-relaxed">
                        <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                            This message will be courteously shared with <strong>{requesterName}</strong>, closing the proposal with deeni adab and preserving mutual respect.
                        </span>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 sm:p-5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        Keep Pending / Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-[#881337] to-[#9F1239] hover:from-[#9F1239] hover:to-[#881337] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <span>Sending...</span>
                        ) : (
                            <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Send with Adab & Decline</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
