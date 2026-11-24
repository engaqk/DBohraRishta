"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Sparkles, Heart, Clock, ShieldCheck, MapPin, GraduationCap, Briefcase, 
    Send, CheckCircle, ChevronRight, RefreshCw, MessageCircle, User, 
    Compass, Lock, Coffee, BookOpen, Users, Star, ArrowRight, X, Edit3, Loader2 
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { triggerHaptic, HapticPatterns } from '@/lib/uiUtils';

interface SoulSyncTabProps {
    currentUser: any;
    myProfile: any;
    availableProfiles: any[];
    allRequests: any[];
    onRequestSent: (targetId: string, isSoulSync: boolean) => Promise<void>;
    onBrowseDiscovery: () => void;
}

// Simple deterministic hash function for consistent daily rotation
function getDeterministicDailyHash(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

export default function SoulSyncTab({
    currentUser,
    myProfile,
    availableProfiles,
    allRequests,
    onRequestSent,
    onBrowseDiscovery
}: SoulSyncTabProps) {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [activeCardTab, setActiveCardTab] = useState<'icebreakers' | 'biodata'>('icebreakers');
    const [isSending, setIsSending] = useState(false);
    const [countdownStr, setCountdownStr] = useState('');
    const [showCustomizeModal, setShowCustomizeModal] = useState(false);
    const [customizingLoading, setCustomizingLoading] = useState(false);
    const [showFullBiodataSheet, setShowFullBiodataSheet] = useState(false);

    // Custom Icebreaker inputs for current user
    const [myZiyarat, setMyZiyarat] = useState(myProfile?.icebreakerZiyarat || '');
    const [myValue, setMyValue] = useState(myProfile?.icebreakerValue || '');
    const [mySunday, setMySunday] = useState(myProfile?.icebreakerSunday || '');

    // Synchronize inputs with myProfile
    useEffect(() => {
        if (myProfile) {
            setMyZiyarat(myProfile.icebreakerZiyarat || '');
            setMyValue(myProfile.icebreakerValue || '');
            setMySunday(myProfile.icebreakerSunday || '');
        }
    }, [myProfile]);

    // Live countdown to next 8:00 PM drop
    useEffect(() => {
        const calculateCountdown = () => {
            const now = new Date();
            const target = new Date();
            target.setHours(20, 0, 0, 0); // 8:00 PM

            if (now.getTime() >= target.getTime()) {
                // If it's already past 8:00 PM today, target is 8:00 PM tomorrow
                target.setDate(target.getDate() + 1);
            }

            const diff = target.getTime() - now.getTime();
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const secs = Math.floor((diff % (1000 * 60)) / 1000);

            setCountdownStr(`${hours.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`);
        };

        calculateCountdown();
        const interval = setInterval(calculateCountdown, 1000);
        return () => clearInterval(interval);
    }, []);

    // Deterministic selection of 3 candidates for today
    const dateKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const requestedIds = useMemo(() => {
        const set = new Set<string>();
        allRequests.forEach(r => {
            if (r.from === currentUser?.uid) set.add(r.to);
            if (r.to === currentUser?.uid && r.status === 'accepted') set.add(r.from);
        });
        return set;
    }, [allRequests, currentUser]);

    const dailyCandidates = useMemo(() => {
        if (!availableProfiles || availableProfiles.length === 0 || !currentUser) return [];

        const unrequested = availableProfiles.filter(p => !requestedIds.has(p.id));
        if (unrequested.length === 0) return [];

        // Score each candidate combining match synergy and date hash
        const scored = unrequested.map(p => {
            const seed = `${currentUser.uid}_${p.id}_${dateKey}`;
            const pseudoRand = getDeterministicDailyHash(seed) % 1000;
            const synergy = (p.matchScore || 50) * 10;
            return {
                candidate: p,
                rankScore: synergy + pseudoRand
            };
        });

        scored.sort((a, b) => b.rankScore - a.rankScore);
        return scored.slice(0, 3).map(s => s.candidate);
    }, [availableProfiles, requestedIds, currentUser, dateKey]);

    const currentCandidate = dailyCandidates[currentIndex];

    const handleSendSalam = async () => {
        if (!currentCandidate) return;
        setIsSending(true);
        try {
            await onRequestSent(currentCandidate.id, true);
            triggerHaptic(HapticPatterns.SUCCESS);
            toast.success(`✨ Salam & Golden SoulSync Interest sent to ${currentCandidate.name || 'Candidate'}!`, {
                icon: '💍',
                duration: 4000
            });
            setShowFullBiodataSheet(false);
            setCurrentIndex(prev => prev + 1);
            setActiveCardTab('icebreakers');
        } catch (err: any) {
            toast.error(err.message || 'Failed to send interest.');
        } finally {
            setIsSending(false);
        }
    };

    const handlePassDua = () => {
        triggerHaptic(HapticPatterns.LIGHT);
        toast(`Dua for ${currentCandidate?.name || 'candidate'}. Showing next alignment...`, {
            icon: '🤲',
            duration: 2000
        });
        setShowFullBiodataSheet(false);
        setCurrentIndex(prev => prev + 1);
        setActiveCardTab('icebreakers');
    };

    const handleSaveMyIcebreakers = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setCustomizingLoading(true);
        try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
                icebreakerZiyarat: myZiyarat.trim(),
                icebreakerValue: myValue.trim(),
                icebreakerSunday: mySunday.trim(),
                updatedAt: serverTimestamp()
            });
            toast.success('Your 3 Icebreaker Cards updated successfully! They will appear in alignments sent to other candidates.', {
                icon: '✨'
            });
            setShowCustomizeModal(false);
        } catch (err: any) {
            toast.error('Failed to update: ' + err.message);
        } finally {
            setCustomizingLoading(false);
        }
    };

    return (
        <section className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Banner - Gen Z Bohra Aesthetic */}
            <div className="bg-gradient-to-r from-amber-500 via-[#881337] to-[#4c0519] rounded-3xl p-6 md:p-8 text-white shadow-xl mb-6 relative overflow-hidden border border-amber-300/40">
                <div className="absolute top-0 right-0 translate-x-8 -translate-y-8 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 -translate-x-8 translate-y-8 w-48 h-48 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 bg-black/25 backdrop-blur-md px-3 py-1 rounded-full text-amber-300 text-xs font-black uppercase tracking-widest border border-amber-300/30 mb-2">
                            <Sparkles className="w-3.5 h-3.5 fill-amber-300 animate-spin" />
                            <span>8:00 PM Daily Drop • Divine Alignments</span>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black font-serif tracking-tight">
                            SoulSync ✨ (Daily Alignments)
                        </h2>
                        <p className="text-rose-100 text-xs md:text-sm mt-1 max-w-xl font-medium leading-relaxed">
                            Every evening at 8:00 PM, 3 verified candidates are curated for your family by Aqa Maula&apos;s TUS Dua Mubarak. Explore their 3 Halal Icebreaker cards and connect with intention.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-3 shrink-0">
                        {/* Countdown to next drop */}
                        <div className="bg-black/40 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-inner">
                            <Clock className="w-5 h-5 text-amber-300 shrink-0" />
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-rose-200 font-bold">Next Drop In</p>
                                <p className="text-base font-black font-mono text-white tracking-wider">{countdownStr || 'Calculating...'}</p>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowCustomizeModal(true)}
                            className="bg-white/15 hover:bg-white/25 text-white active:scale-95 text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-white/25 flex items-center gap-1.5 shadow-xs"
                        >
                            <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                            <span>My 3 Icebreaker Cards</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Interactive Card Container */}
            {dailyCandidates.length > 0 && currentIndex < dailyCandidates.length ? (
                <div className="max-w-2xl mx-auto">
                    {/* Progress Pills */}
                    <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center gap-2">
                            {dailyCandidates.map((_, idx) => (
                                <div 
                                    key={idx}
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                        idx === currentIndex 
                                            ? 'w-10 bg-[#881337]' 
                                            : idx < currentIndex 
                                                ? 'w-6 bg-emerald-500' 
                                                : 'w-6 bg-gray-200'
                                    }`}
                                />
                            ))}
                            <span className="text-xs font-black text-gray-500 ml-2">
                                Alignment {currentIndex + 1} of {dailyCandidates.length}
                            </span>
                        </div>

                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                            ✨ Active 24-Hour Cycle
                        </span>
                    </div>

                    {/* Active Candidate Card */}
                    <div className="bg-white rounded-3xl shadow-xl border border-rose-100 overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Header Image & High-Level Identity */}
                        <div className="relative h-64 sm:h-72 w-full bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                            <img 
                                src={currentCandidate.libasImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentCandidate.name || 'Candidate')}&background=881337&color=ffffff&size=256`} 
                                alt={currentCandidate.name} 
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                            {/* Badges on photo */}
                            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                                <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-rose-950 text-xs font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5 border border-amber-200">
                                    <Sparkles className="w-3.5 h-3.5 fill-rose-950" />
                                    <span>SoulSync Match #{currentIndex + 1}</span>
                                </span>

                                {currentCandidate.isItsVerified && (
                                    <span className="bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow flex items-center gap-1 border border-white/20">
                                        <ShieldCheck className="w-3 h-3" /> ITS Verified
                                    </span>
                                )}
                            </div>

                            {/* Candidate Summary on Photo */}
                            <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h3 className="text-2xl font-black font-serif flex items-center gap-2">
                                    {currentCandidate.name}
                                    {currentCandidate.age && <span className="text-base font-normal text-rose-200">({currentCandidate.age} yrs)</span>}
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-rose-100 mt-1">
                                    {(currentCandidate.city || currentCandidate.location) && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-amber-300" /> {currentCandidate.city || currentCandidate.location}
                                        </span>
                                    )}
                                    {currentCandidate.education && (
                                        <span className="flex items-center gap-1">
                                            <GraduationCap className="w-3 h-3 text-amber-300" /> {currentCandidate.education}
                                        </span>
                                    )}
                                    {currentCandidate.professionType && (
                                        <span className="flex items-center gap-1">
                                            <Briefcase className="w-3 h-3 text-amber-300" /> {currentCandidate.professionType}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Sub-Tabs within card */}
                        <div className="flex border-b border-gray-100 bg-gray-50/70 p-1.5">
                            <button
                                onClick={() => setActiveCardTab('icebreakers')}
                                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                    activeCardTab === 'icebreakers'
                                        ? 'bg-white text-[#881337] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                                <span>3 Halal Icebreaker Cards</span>
                            </button>
                            <button
                                onClick={() => setActiveCardTab('biodata')}
                                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                                    activeCardTab === 'biodata'
                                        ? 'bg-white text-[#881337] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <BookOpen className="w-3.5 h-3.5 text-[#881337]" />
                                <span>Biodata & Family Details</span>
                            </button>
                        </div>

                        {/* Sub-Tab Content */}
                        <div className="p-5 sm:p-6 min-h-[220px]">
                            {activeCardTab === 'icebreakers' ? (
                                <div className="space-y-3.5 animate-in fade-in duration-200">
                                    {/* Question 1: Ziyarat Memory */}
                                    <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs mb-1">
                                            <span className="text-base">🕌</span>
                                            <span>My Most Cherished Ziyarat Memory</span>
                                        </div>
                                        <p className="text-xs text-gray-700 italic font-medium leading-relaxed pl-6">
                                            &ldquo;{currentCandidate.icebreakerZiyarat || "Performing Ziyarat of Imam Husain (AS) in Karbala Mua'lla with family and seeking Aqa Maula's TUS Dua Mubarak."}&rdquo;
                                        </p>
                                    </div>

                                    {/* Question 2: Value from parents */}
                                    <div className="bg-rose-50/60 border border-rose-200/70 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 text-[#881337] font-bold text-xs mb-1">
                                            <span className="text-base">👨‍👩‍👧</span>
                                            <span>One Value My Parents Taught Me That I Live By</span>
                                        </div>
                                        <p className="text-xs text-gray-700 italic font-medium leading-relaxed pl-6">
                                            &ldquo;{currentCandidate.icebreakerValue || "Humility in conversation, maintaining barakat in daily life, and regular attendance in Jamaat Majalis."}&rdquo;
                                        </p>
                                    </div>

                                    {/* Question 3: Sunday evening */}
                                    <div className="bg-indigo-50/60 border border-indigo-200/70 rounded-2xl p-4">
                                        <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs mb-1">
                                            <span className="text-base">☕</span>
                                            <span>My Ideal Sunday Evening</span>
                                        </div>
                                        <p className="text-xs text-gray-700 italic font-medium leading-relaxed pl-6">
                                            &ldquo;{currentCandidate.icebreakerSunday || "Attending Jamaat Majlis, spending quality time with family, and enjoying quiet conversation."}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-200 text-xs">
                                    {currentCandidate.bio && (
                                        <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                                            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">About</p>
                                            <p className="text-gray-700 font-medium leading-relaxed">{currentCandidate.bio}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Jamaat</p>
                                            <p className="font-bold text-gray-800">{currentCandidate.jamaat || 'Listed'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Marital Status</p>
                                            <p className="font-bold text-gray-800">{currentCandidate.maritalStatus || 'Single'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Height</p>
                                            <p className="font-bold text-gray-800">{currentCandidate.heightFeet ? `${currentCandidate.heightFeet} ft` : 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Partner Preferences</p>
                                            <p className="font-bold text-gray-800 truncate">{currentCandidate.partnerQualities || 'Noble Bohra family'}</p>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            onClick={() => setShowFullBiodataSheet(true)}
                                            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-[#881337] rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 border border-rose-200 active:scale-95 shadow-xs cursor-pointer"
                                        >
                                            <BookOpen className="w-3.5 h-3.5 text-[#881337]" />
                                            <span>📖 View Full Biodata & Family Details</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Footer: 2 Dignified Buttons */}
                        <div className="p-4 sm:p-5 bg-gray-50/90 border-t border-gray-100 flex items-center gap-3">
                            <button
                                onClick={handlePassDua}
                                disabled={isSending}
                                className="flex-1 py-3.5 px-4 rounded-2xl font-bold text-xs text-gray-600 bg-white hover:bg-gray-100 border border-gray-200 transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
                            >
                                <span>🤲 Pass with Dua</span>
                            </button>

                            <button
                                onClick={handleSendSalam}
                                disabled={isSending}
                                className="flex-[2] py-3.5 px-5 rounded-2xl font-black text-xs text-rose-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                {isSending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 fill-rose-950" />
                                        <span>🕊️ Send Salam (Golden Interest)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Celebration / Completed State for Today */
                <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 md:p-10 text-center shadow-lg border border-rose-100 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gradient-to-tr from-amber-400 to-[#881337] text-white rounded-full flex items-center justify-center shadow-md mb-4 text-2xl">
                        🎉
                    </div>

                    <h3 className="text-2xl font-bold font-serif text-[#881337] mb-2">
                        Alhamdulillah! You&apos;ve Reviewed Today&apos;s SoulSync Drop
                    </h3>

                    <p className="text-gray-600 text-xs md:text-sm max-w-md leading-relaxed mb-6">
                        Every day at 8:00 PM, 3 fresh verified alignments are curated for you. While you await tomorrow&apos;s drop, continue exploring the full candidate pool or refine your own icebreaker cards!
                    </p>

                    {/* Countdown Box */}
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 w-full max-w-sm mb-6 flex items-center justify-center gap-3">
                        <Clock className="w-5 h-5 text-amber-700 shrink-0" />
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase text-amber-800 tracking-wider">Next 3 Alignments Drop In</p>
                            <p className="text-lg font-black font-mono text-[#881337]">{countdownStr}</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
                        <button
                            onClick={onBrowseDiscovery}
                            className="w-full bg-[#881337] hover:bg-[#9F1239] text-white py-3 rounded-2xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                            <Compass className="w-4 h-4" />
                            <span>Browse All Candidates</span>
                        </button>
                        <button
                            onClick={() => {
                                setCurrentIndex(0);
                                setActiveCardTab('icebreakers');
                            }}
                            className="w-full bg-white hover:bg-rose-50 text-[#881337] border border-rose-200 py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Review Today&apos;s Alignments</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Customize My 3 Icebreaker Cards */}
            {showCustomizeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-[#881337] text-white p-5 flex items-center justify-between">
                            <div>
                                <h4 className="font-bold text-base flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-300" />
                                    <span>Personalize Your 3 Icebreakers</span>
                                </h4>
                                <p className="text-rose-200 text-xs mt-0.5">
                                    These 3 answers appear when other candidates see you in their SoulSync drop!
                                </p>
                            </div>
                            <button
                                onClick={() => setShowCustomizeModal(false)}
                                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveMyIcebreakers} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <span>🕌</span>
                                    <span>1. My Most Cherished Ziyarat Memory</span>
                                </label>
                                <textarea
                                    value={myZiyarat}
                                    onChange={(e) => setMyZiyarat(e.target.value)}
                                    placeholder="e.g. Walking between Karbala and Najaf with family during Arbaeen..."
                                    rows={2}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#881337]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <span>👨‍👩‍👧</span>
                                    <span>2. One Value My Parents Taught Me That I Live By</span>
                                </label>
                                <textarea
                                    value={myValue}
                                    onChange={(e) => setMyValue(e.target.value)}
                                    placeholder="e.g. Always speaking with humility, maintaining barakat, and helping community..."
                                    rows={2}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#881337]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                                    <span>☕</span>
                                    <span>3. My Ideal Sunday Evening</span>
                                </label>
                                <textarea
                                    value={mySunday}
                                    onChange={(e) => setMySunday(e.target.value)}
                                    placeholder="e.g. Attending Jamaat Majlis, family dinner, and exploring quiet cafes..."
                                    rows={2}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#881337]"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCustomizeModal(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={customizingLoading}
                                    className="bg-[#881337] hover:bg-[#9F1239] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                                >
                                    {customizingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    <span>Save Icebreakers</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal / Sheet: In-Screen Full Biodata Details */}
            {showFullBiodataSheet && currentCandidate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl border border-rose-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-amber-500 via-[#881337] to-[#4c0519] text-white p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-black/25 text-amber-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-amber-300/30">
                                        SoulSync Alignment {currentIndex + 1} of {dailyCandidates.length}
                                    </span>
                                    {currentCandidate.isItsVerified && (
                                        <span className="bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <ShieldCheck className="w-3 h-3" /> ITS Verified
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black font-serif mt-1 flex items-center gap-2">
                                    {currentCandidate.name}
                                    {currentCandidate.age && <span className="text-sm font-normal text-rose-200">({currentCandidate.age} yrs)</span>}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowFullBiodataSheet(false)}
                                className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer"
                                title="Return to SoulSync Card"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-grow">
                            {/* Photo & High Level Details */}
                            <div className="flex flex-col sm:flex-row items-center gap-4 bg-rose-50/40 p-4 rounded-2xl border border-rose-100">
                                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-md border-2 border-white shrink-0">
                                    <img 
                                        src={currentCandidate.libasImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentCandidate.name || 'Candidate')}&background=881337&color=ffffff&size=256`} 
                                        alt={currentCandidate.name} 
                                        className="w-full h-full object-cover" 
                                    />
                                </div>
                                <div className="flex-1 text-center sm:text-left space-y-1">
                                    <p className="text-base font-bold text-[#881337]">{currentCandidate.name}</p>
                                    <p className="text-gray-600 font-medium">
                                        {currentCandidate.jamaat && `${currentCandidate.jamaat} · `}
                                        {currentCandidate.city || currentCandidate.location || 'Bohra Member'}
                                    </p>
                                    <p className="text-gray-600">
                                        {currentCandidate.education && `🎓 ${currentCandidate.education}`}
                                        {currentCandidate.professionType && ` · 💼 ${currentCandidate.professionType}`}
                                    </p>
                                    <p className="text-[11px] text-amber-700 font-bold">
                                        ✨ Curated for your family in today&apos;s 8:00 PM drop
                                    </p>
                                </div>
                            </div>

                            {/* 3 Halal Icebreaker Cards Highlight */}
                            <div>
                                <h4 className="font-bold text-sm text-[#881337] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span>3 Halal Icebreaker Answers</span>
                                </h4>
                                <div className="space-y-2.5">
                                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-amber-900 uppercase">🕌 Cherished Ziyarat Memory</p>
                                        <p className="text-xs text-gray-700 italic mt-0.5">
                                            &ldquo;{currentCandidate.icebreakerZiyarat || "Performing Ziyarat of Imam Husain (AS) in Karbala Mua'lla with family and seeking Aqa Maula's TUS Dua Mubarak."}&rdquo;
                                        </p>
                                    </div>
                                    <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-[#881337] uppercase">👨‍👩‍👧 Core Value From Parents</p>
                                        <p className="text-xs text-gray-700 italic mt-0.5">
                                            &ldquo;{currentCandidate.icebreakerValue || "Humility in conversation, maintaining barakat in daily life, and regular attendance in Jamaat Majalis."}&rdquo;
                                        </p>
                                    </div>
                                    <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3">
                                        <p className="text-[10px] font-bold text-indigo-900 uppercase">☕ Ideal Sunday Evening</p>
                                        <p className="text-xs text-gray-700 italic mt-0.5">
                                            &ldquo;{currentCandidate.icebreakerSunday || "Attending Jamaat Majlis, spending quality time with family, and enjoying quiet conversation."}&rdquo;
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Personal & Physical Details */}
                            <div>
                                <h4 className="font-bold text-sm text-[#881337] uppercase tracking-wide mb-2">Personal & Family Background</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Marital Status</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.maritalStatus || 'Single'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Height</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.heightFeet ? `${currentCandidate.heightFeet} ft` : 'Not specified'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Complexion</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.complexion || currentCandidate.skinTone || 'Fair'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Father&apos;s Name</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.fatherName || 'Listed'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Mother&apos;s Name</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.motherName || 'Listed'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                        <p className="text-[9px] uppercase font-bold text-gray-400">Hizrat Preference</p>
                                        <p className="font-bold text-gray-800">{currentCandidate.hizratLocation || 'Open to Discussion'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bio / About */}
                            {currentCandidate.bio && (
                                <div>
                                    <h4 className="font-bold text-sm text-[#881337] uppercase tracking-wide mb-1.5">About Candidate</h4>
                                    <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                                        <p className="text-gray-700 leading-relaxed font-medium">{currentCandidate.bio}</p>
                                    </div>
                                </div>
                            )}

                            {/* Partner Expectations */}
                            <div>
                                <h4 className="font-bold text-sm text-[#881337] uppercase tracking-wide mb-1.5">Partner Qualities Desired</h4>
                                <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
                                    <p className="text-gray-800 font-medium leading-relaxed">
                                        {currentCandidate.partnerQualities || "Seeking an understanding, deeni, educated partner from a respected Dawoodi Bohra family."}
                                    </p>
                                </div>
                            </div>

                            {/* Secondary link to open standalone page */}
                            <div className="pt-2 text-center">
                                <button
                                    onClick={() => router.push(`/profile?id=${currentCandidate.id}&from=soulsync`)}
                                    className="text-[11px] text-[#881337] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Open Standalone Full Profile Page</span>
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-200 flex items-center gap-2 sm:gap-3 shrink-0">
                            <button
                                onClick={() => setShowFullBiodataSheet(false)}
                                className="flex-1 py-3 px-3 rounded-2xl font-bold text-xs text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
                            >
                                <span>← Back to Alignment</span>
                            </button>

                            <button
                                onClick={handlePassDua}
                                disabled={isSending}
                                className="flex-1 py-3 px-3 rounded-2xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
                            >
                                <span>🤲 Pass with Dua</span>
                            </button>

                            <button
                                onClick={handleSendSalam}
                                disabled={isSending}
                                className="flex-[2] py-3 px-4 rounded-2xl font-black text-xs text-rose-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {isSending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5 fill-rose-950" />
                                        <span>🕊️ Send Salam (Connect)</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
