"use client";
import React, { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COMPATIBILITY_POLLS, getDailyPoll, CompatibilityPoll } from '@/lib/compatibilityPolls';
import { Sparkles, CheckCircle2, ArrowRight, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { triggerHaptic, HapticPatterns } from '@/lib/uiUtils';

interface DailyCompatibilityPollProps {
    userId: string;
    myPolls?: Record<string, string>;
    availableProfiles?: any[];
    onPollAnswered: (pollId: string, optionId: string) => void;
}

export default function DailyCompatibilityPoll({
    userId,
    myPolls = {},
    availableProfiles = [],
    onPollAnswered,
}: DailyCompatibilityPollProps) {
    const [minimized, setMinimized] = useState(false);
    const [savingOption, setSavingOption] = useState<string | null>(null);
    const [justAnswered, setJustAnswered] = useState<{
        poll: CompatibilityPoll;
        optionId: string;
        optionLabel: string;
        matchCount: number;
    } | null>(null);
    const [manualPollIndex, setManualPollIndex] = useState<number | null>(null);

    const answeredCount = Object.keys(myPolls || {}).filter(k =>
        COMPATIBILITY_POLLS.some(p => p.id === k)
    ).length;
    const totalPolls = COMPATIBILITY_POLLS.length;

    const activePoll = useMemo(() => {
        if (manualPollIndex !== null) {
            const unanswered = COMPATIBILITY_POLLS.filter(p => !myPolls[p.id]);
            if (unanswered.length > 0) {
                return unanswered[manualPollIndex % unanswered.length];
            }
            return COMPATIBILITY_POLLS[manualPollIndex % COMPATIBILITY_POLLS.length];
        }
        return getDailyPoll(myPolls);
    }, [myPolls, manualPollIndex]);

    const handleSelectOption = async (poll: CompatibilityPoll, optionId: string, optionLabel: string) => {
        if (!userId || savingOption) return;
        setSavingOption(optionId);

        try {
            triggerHaptic(HapticPatterns.LIGHT);
            await updateDoc(doc(db, 'users', userId), {
                [`compatibilityPolls.${poll.id}`]: optionId,
            });

            // Count how many candidates in feed match this exact answer
            const matchCount = availableProfiles.filter(
                p => p.compatibilityPolls?.[poll.id] === optionId
            ).length;

            onPollAnswered(poll.id, optionId);
            setJustAnswered({
                poll,
                optionId,
                optionLabel,
                matchCount,
            });
            toast.success('Mindset saved! Shared values updated on cards ✨', { duration: 2500 });
        } catch (err) {
            console.error('Failed to save compatibility poll:', err);
            toast.error('Could not save your answer. Please try again.');
        } finally {
            setSavingOption(null);
        }
    };

    const handleNextQuestion = () => {
        setJustAnswered(null);
        setManualPollIndex(prev => (prev === null ? 1 : prev + 1));
    };

    if (minimized) {
        return (
            <div className="mb-5 flex items-center justify-between bg-gradient-to-r from-amber-50/90 via-rose-50/60 to-amber-50/90 border border-amber-200/80 rounded-2xl px-4 py-2.5 shadow-xs">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                    <span className="text-xs font-bold text-[#881337]">
                        Daily Mindset Pulse ({answeredCount}/{totalPolls} answered)
                    </span>
                </div>
                <button
                    onClick={() => setMinimized(false)}
                    className="text-xs font-black text-[#881337] hover:underline flex items-center gap-1 cursor-pointer"
                >
                    <span>Open</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                </button>
            </div>
        );
    }

    // All polls answered state (and not showing justAnswered celebration)
    if (!activePoll && !justAnswered) {
        return (
            <div className="mb-6 bg-gradient-to-r from-emerald-50/90 via-white to-amber-50/80 border border-emerald-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-emerald-900">
                            ✨ Mindset Profile Complete ({totalPolls}/{totalPolls})
                        </p>
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                            Shared values are automatically highlighted on matching candidate cards!
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setManualPollIndex(0)}
                    className="text-[11px] font-bold text-emerald-800 bg-white hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                    <RefreshCw className="w-3 h-3" />
                    <span>Review / Update</span>
                </button>
            </div>
        );
    }

    return (
        <div className="mb-6 bg-gradient-to-br from-amber-50/90 via-white to-rose-50/70 border border-amber-200/90 rounded-3xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-[#881337] to-[#9F1239] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-[#D4AF37]" />
                        1-Tap Mindset Poll
                    </span>
                    {activePoll && !justAnswered && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                            {activePoll.category}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                    <span className="text-[11px] font-bold text-gray-500">
                        {answeredCount}/{totalPolls} answered
                    </span>
                    <button
                        onClick={() => setMinimized(true)}
                        className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100/80 transition-colors cursor-pointer"
                        title="Minimize poll"
                    >
                        <ChevronUp className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {justAnswered ? (
                /* Instant Feedback & Next Question Loop */
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 animate-in fade-in duration-300">
                    <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-black text-emerald-950">
                                Saved: &ldquo;{justAnswered.optionLabel}&rdquo;
                            </p>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                                {justAnswered.matchCount > 0
                                    ? `✨ ${justAnswered.matchCount} candidate${justAnswered.matchCount > 1 ? 's' : ''} in your Discovery feed share this exact value!`
                                    : `✨ Great choice! Candidates with this same mindset will now show a Shared Value badge.`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        {answeredCount < totalPolls && (
                            <button
                                onClick={handleNextQuestion}
                                className="px-3.5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#881337] to-[#9F1239] text-white shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                                <span>Next Question</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setJustAnswered(null);
                                if (answeredCount >= totalPolls) setManualPollIndex(null);
                                else setMinimized(true);
                            }}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-100/60 transition-all cursor-pointer"
                        >
                            Done ✓
                        </button>
                    </div>
                </div>
            ) : activePoll ? (
                /* Question & 1-Tap Option Pills */
                <div>
                    <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span>{activePoll.emoji}</span>
                        <span>{activePoll.question}</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {activePoll.options.map((opt) => {
                            const isSelected = myPolls[activePoll.id] === opt.id;
                            const isSaving = savingOption === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelectOption(activePoll, opt.id, opt.label)}
                                    disabled={!!savingOption}
                                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all flex items-center gap-2 border cursor-pointer active:scale-98 ${
                                        isSelected
                                            ? 'bg-[#881337] text-white border-[#881337] shadow-md'
                                            : 'bg-white hover:bg-rose-50/70 text-gray-800 border-gray-200 hover:border-rose-300 shadow-2xs'
                                    }`}
                                >
                                    <span className="text-base shrink-0">{opt.emoji}</span>
                                    <span className="flex-1 leading-snug">{opt.label}</span>
                                    {isSaving && <span className="text-[10px] opacity-80">...</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
