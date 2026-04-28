"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, ExternalLink, Sparkles, Layers, ChevronLeft, ChevronRight, Bookmark, Clock, Lock, PauseCircle, X, Video } from 'lucide-react';
import { notifyInterestSent } from '@/lib/emailService';
import { collection, addDoc, query, where, getDocs, serverTimestamp, deleteDoc, doc, onSnapshot, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';
import { triggerHaptic, HapticPatterns } from '@/lib/uiUtils';

interface DiscoveryCardProps {
    id: string;
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    location?: string;
    hizratLocation?: string;
    itsImageUrl?: string;
    libasImageUrl?: string;
    matchScore?: number;
    isMyProfileVerified?: boolean;
    gender?: string;
    heightFeet?: string;
    heightInch?: string;
    hobbies?: string;
    partnerQualities?: string;
    isBlurSecurityEnabled?: boolean;
    isItsVerified?: boolean;
    bio?: string;
    isOnline?: boolean;
    viewerItsNumber?: string;
    extraImageUrl?: string;
    ejamaatId?: string;
    itsNumber?: string;
    maritalStatus?: string;
    mobile?: string;
    mobileCode?: string;
    email?: string;
    fatherName?: string;
    motherName?: string;
    professionType?: string;
    educationDetails?: string;
    city?: string;
    state?: string;
    country?: string;
    createdAt?: any;
    selfieImageUrl?: string;
    selfieStatus?: string;
    voiceIntroUrl?: string;
    videoIntroUrl?: string;
    videoStatus?: string;
    lastActive?: any;
    requestId?: string;
    initialRequestStatus?: string;
    isIncomingRequest?: boolean;
    onAcceptInterest?: (requestId: string) => void;
    onDeclineInterest?: (requestId: string) => void;
}

export default function DiscoveryCard({
    id, name, dob, jamaat, education, location, hizratLocation, libasImageUrl, matchScore = 85,
    isMyProfileVerified = false, heightFeet, heightInch,
    partnerQualities, isBlurSecurityEnabled = true, isItsVerified = false, bio,
    isOnline = false, viewerItsNumber = '', extraImageUrl,
    ejamaatId, itsNumber, maritalStatus, mobile, mobileCode, email,
    fatherName, motherName, professionType, educationDetails,
    city, state, gender, createdAt, selfieImageUrl, selfieStatus, voiceIntroUrl, videoIntroUrl, videoStatus, lastActive,
    requestId, initialRequestStatus, isIncomingRequest, onAcceptInterest, onDeclineInterest
}: DiscoveryCardProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [requestSent, setRequestSent] = useState(false);
    const [requestStatus, setRequestStatus] = useState<string | null>(null);
    const [isRejectedRecipient, setIsRejectedRecipient] = useState(false);
    const [loading, setLoading] = useState(false);
    const [localIsIncoming, setLocalIsIncoming] = useState<boolean | undefined>(isIncomingRequest);
    const [rejectCount, setRejectCount] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
    const [icebreakerText, setIcebreakerText] = useState('');
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);
    const [isPlayingVoice, setIsPlayingVoice] = useState(false);
    const [audioInstance, setAudioInstance] = useState<HTMLAudioElement | null>(null);
    const [showVideoIntro, setShowVideoIntro] = useState(false);

    // Voice Playback Handler
    const toggleVoicePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!voiceIntroUrl) return;

        if (isPlayingVoice) {
            audioInstance?.pause();
            setIsPlayingVoice(false);
        } else {
            if (audioInstance) {
                audioInstance.play();
                setIsPlayingVoice(true);
            } else {
                const audio = new Audio(voiceIntroUrl);
                audio.onended = () => setIsPlayingVoice(false);
                audio.play();
                setAudioInstance(audio);
                setIsPlayingVoice(true);
            }
        }
    };

    const [profileData, setProfileData] = useState<any>(null);

    const photos = [
        videoIntroUrl,
        profileData?.libasImageUrl || libasImageUrl,
        profileData?.extraImageUrl || extraImageUrl,
        (profileData?.isPhotoVerified || profileData?.selfieStatus === 'verified' ? profileData?.selfieImageUrl : null)
    ].filter(Boolean) as string[];
    const currentPhoto = photos[activePhotoIdx];
    const isVideo = currentPhoto?.startsWith('data:video') || currentPhoto?.endsWith('.mp4') || currentPhoto?.endsWith('.webm');
    const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : 25;
    const isFemale = gender === 'female';
    const canZoom = !isBlurSecurityEnabled || requestStatus === 'accepted' || !isFemale;

    const firstName = name?.split(' ')[0] || 'Member';
    const displaySurname = (gender === 'female' && requestStatus !== 'accepted') ? '●●●●' : name?.split(' ').slice(1).join(' ');
    const displayName = `${firstName} ${displaySurname}`.trim();

    // Activity Ribbon Logic
    const isNewMember = useMemo(() => {
        if (!createdAt) return false;
        const createdDate = createdAt?.toDate ? createdAt.toDate() : new Date(createdAt);
        return (Date.now() - createdDate.getTime()) < 172800000; // 48 Hours
    }, [createdAt]);

    const isHighlyResponsive = useMemo(() => {
        if (isOnline) return true;
        if (!lastActive) return false;
        const activeDate = lastActive?.toDate ? lastActive.toDate() : new Date(lastActive);
        return (Date.now() - activeDate.getTime()) < 3600000; // Active within 1 hour
    }, [isOnline, lastActive]);

    const profileStrength = useMemo(() => {
        if (!profileData) return 0;
        let score = 0;
        if (profileData.name) score += 5;
        if (profileData.gender) score += 5;
        if (profileData.dob) score += 5;
        if (profileData.jamaat) score += 5;
        if (profileData.mobile || profileData.verifiedPhone) score += 5;
        if (profileData.isEmailVerified) score += 5;
        if (profileData.isItsVerified) score += 5;
        if (profileData.education || profileData.educationDetails) score += 10;
        if (profileData.professionType || profileData.profession) score += 10;
        if (profileData.maritalStatus) score += 5;
        if (profileData.heightFeet) score += 5;
        if (profileData.bio) score += 5;
        if (profileData.libasImageUrl) score += 15;
        if (profileData.extraImageUrl) score += 5;
        if (profileData.isPhotoVerified || profileData.selfieStatus === 'verified') score += 5;
        if (profileData.voiceIntroUrl || profileData.videoIntroUrl) score += 5;
        return Math.min(100, score);
    }, [profileData]);

    const isVerifiedContributor = profileStrength >= 95;

    useEffect(() => {
        const check = async () => {
            if (!user) return;
            let active = false; let rejects = 0; let wasRejectedRecipient = false;
            let currentS = '';
            let incoming = isIncomingRequest;

            // Use props if available
            if (initialRequestStatus) {
                currentS = initialRequestStatus;
                incoming = isIncomingRequest;
                if (initialRequestStatus === 'rejected' || initialRequestStatus === 'ended') {
                    if (isIncomingRequest === true) {
                        wasRejectedRecipient = true;
                    } else if (isIncomingRequest === false) {
                        rejects++;
                    }
                } else {
                    active = true;
                }
            } else {
                const qOut = query(collection(db, 'rishta_requests'), where('from', '==', user.uid), where('to', '==', id));
                const qIn = query(collection(db, 'rishta_requests'), where('from', '==', id), where('to', '==', user.uid));
                const [sOut, sIn] = await Promise.all([getDocs(qOut), getDocs(qIn)]);
                
                sOut.forEach(d => {
                    const s = d.data().status;
                    if (s === 'rejected' || s === 'ended') { 
                        rejects++; 
                    } else { active = true; currentS = s; incoming = false; }
                });

                sIn.forEach(d => {
                    const s = d.data().status;
                    if (s === 'rejected' || s === 'ended') { 
                        wasRejectedRecipient = true; 
                    } else { active = true; currentS = s; incoming = true; }
                });
            }
            
            setRequestStatus(currentS);
            setRequestSent(active); 
            setLocalIsIncoming(incoming);
            setRejectCount(rejects);
            setIsRejectedRecipient(wasRejectedRecipient);

            // Fetch Bookmark Status
            const qB = query(collection(db, 'bookmarks'), where('userId', '==', user.uid), where('profileId', '==', id));
            const sB = await getDocs(qB);
            setIsBookmarked(!sB.empty);
        };
        check();

        // Live status listener
        const unsub = onSnapshot(doc(db, "users", id), (snap) => {
            if (snap.exists()) {
                setProfileData(snap.data());
            }
        });

        return () => unsub();
    }, [user, id, initialRequestStatus, isIncomingRequest]);
 
    const icebreakerError = useMemo(() => {
        if (!icebreakerText) return null;
        if (icebreakerText.includes('@')) return "Email addresses are not allowed for security";
        const digits = icebreakerText.replace(/\D/g, '');
        if (digits.length >= 8) return "Phone numbers/Contact info not allowed in message";
        const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
        const socialPattern = /\b(insta|fb|facebook|instagram|snapchat|snap|telegram|linkedin|whatsapp|wa)\b/i;
        if (linkPattern.test(icebreakerText)) return "Website links are not allowed in message";
        if (socialPattern.test(icebreakerText)) return "Social handles/links are not allowed in message";
        return null;
    }, [icebreakerText]);
 
    const handleToggleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) { toast.error('Log in to bookmark'); return; }

        try {
            const q = query(collection(db, 'bookmarks'), where('userId', '==', user.uid), where('profileId', '==', id));
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Remove
                await deleteDoc(doc(db, 'bookmarks', snap.docs[0].id));
                setIsBookmarked(false);
                toast.success('Removed from bookmarks');
            } else {
                // Add
                await addDoc(collection(db, 'bookmarks'), {
                    userId: user.uid,
                    profileId: id,
                    timestamp: serverTimestamp()
                });
                setIsBookmarked(true);
                triggerHaptic(HapticPatterns.LIGHT);
                toast.success('Profile bookmarked!');
            }
        } catch (e: any) {
            toast.error('Bookmark failed');
        }
    };

    const handleSendRequest = async () => {
        if (!user) { toast.error('You must be logged in'); return; }
        if (!isMyProfileVerified) { toast.error('Your ITS must be verified by Admin before sending requests'); return; }

        // --- 🛡️ Contact Leakage Prevention (Icebreaker) ---
        if (icebreakerText) {
            if (icebreakerText.includes('@')) {
                toast.error("Email addresses are not allowed for security");
                return;
            }
            const digits = icebreakerText.replace(/\D/g, '');
            if (digits.length >= 8) {
                toast.error("Phone numbers/Contact info not allowed in message");
                return;
            }
            const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
            if (linkPattern.test(icebreakerText)) {
                toast.error("Website links are not allowed in message");
                return;
            }
        }

        try {
            setLoading(true);

            // Prevent duplicate requests
            const checkQ = query(collection(db, 'rishta_requests'), where('from', '==', user.uid), where('to', '==', id));
            const checkSnap = await getDocs(checkQ);
            let hasActive = false;
            checkSnap.forEach(d => {
                if (d.data().status !== 'rejected' && d.data().status !== 'ended') hasActive = true;
            });
            if (hasActive) {
                toast.error('An active request already exists.');
                setRequestSent(true);
                setLoading(false);
                return;
            }

            const spamQ = query(collection(db, 'rishta_requests'), where('from', '==', user.uid));
            const spamSnap = await getDocs(spamQ);
            const cutoff = Date.now() - 86400000;
            let recent = 0;
            spamSnap.forEach(d => {
                const ts = d.data().timestamp?.toDate?.() ? d.data().timestamp.toDate().getTime() : 0;
                if (ts > cutoff) recent++;
            });
            if (recent >= 20) { toast.error('Request limit: max 20 per 24 hours', { icon: '🛡️' }); return; }

            const isImpersonating = typeof window !== 'undefined' ? sessionStorage.getItem('impersonate_user_id') : null;

            await addDoc(collection(db, 'rishta_requests'), {
                from: user.uid, to: id, status: 'pending_response',
                icebreaker: icebreakerText.trim(), timestamp: serverTimestamp(),
            });

            // Increment interest count on target profile (only if not impersonating)
            if (!isImpersonating) {
                await updateDoc(doc(db, 'users', id), {
                    interestsCount: increment(1)
                }).catch(() => {});
                triggerHaptic(HapticPatterns.SUCCESS);
            }

            // Email notification via Gmail SMTP API
            if (email) {
                notifyInterestSent({
                    senderName: user.displayName || user.email || 'A Candidate',
                    senderEmail: user.email || '',
                    recipientEmail: email,
                    recipientName: name,
                    icebreaker: icebreakerText.trim() || undefined,
                }).catch(() => { });

                // --- 🔔 In-App Notification to Recipient ---
                await addDoc(collection(db, `users/${id}/notifications`), {
                    type: 'interest_received',
                    title: 'NEW INTEREST REQUEST',
                    message: `${user.displayName || 'A Candidate'} has sent you an interest request. Login to your dashboard to review.`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            }

            setRequestSent(true);
            setShowIcebreakerModal(false);
            toast.success('Interest sent successfully!');
        } catch (err: any) {
            toast.error('Failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeclineClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!requestId || !onDeclineInterest) return;
        
        if (window.confirm("Are you sure you want to decline this interest? This action cannot be easily undone.")) {
            setLoading(true);
            try {
                await onDeclineInterest(requestId);
                setIsRejectedRecipient(true);
                setRequestStatus('rejected');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <>
            <div
                onClick={() => router.push(`/profile?id=${id}`)}
                className={`bg-white rounded-2xl shadow-lg border overflow-hidden w-full flex flex-col transition-all duration-300 cursor-pointer
                ${requestStatus === 'accepted'
                        ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-[0_0_20px_rgba(212,175,55,0.15)]'
                        : 'border-gray-100 hover:shadow-xl hover:-translate-y-0.5'}`}>

                {/* ── PHOTO ── */}
                <div className="relative h-72 cursor-pointer overflow-hidden group/image" onClick={() => canZoom && setShowLightbox(true)}>
                    {currentPhoto ? (
                        <>
                            {/* Stacked Effect for Multiple Photos */}
                            {photos.length > 1 && (
                                <div className="absolute top-1.5 right-1.5 w-full h-full border-2 border-white/10 rounded-2xl translate-x-1.5 translate-y-1.5 -z-10 bg-gray-200/50" />
                            )}

                            {isVideo ? (
                                <video
                                    src={currentPhoto}
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    className={`w-full h-full object-cover transition-all duration-700 ${!canZoom ? 'blur-[8px] scale-105 opacity-60' : ''}`}
                                />
                            ) : (
                                <img
                                    src={currentPhoto}
                                    alt={displayName}
                                    className={`w-full h-full object-cover transition-all duration-700 group-hover/image:scale-110 ${!canZoom ? 'blur-[3px] scale-105' : ''}`}
                                />
                            )}

                            {/* Center Expand Hint */}
                            {canZoom && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover/image:opacity-100 transition-opacity z-10 pointer-events-none">
                                    <div className="bg-white/30 backdrop-blur-md p-3 rounded-full border border-white/20">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            )}
                            {/* Dark overlay reinforces blur privacy effect */}
                            {!canZoom && (
                                <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none" />
                            )}
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <span className="text-5xl opacity-30">👤</span>
                        </div>
                    )}

                    {/* Bottom-to-top gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-20 pointer-events-none" />

                    {/* Top badges */}
                    <div className="absolute top-3 left-3 right-3 z-30 flex items-start justify-between">
                        <div className="flex flex-col gap-1.5 items-start">
                            <div className="flex flex-wrap gap-1.5">
                                {(profileData?.isOnline || isOnline) ? (
                                    <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />Active Now
                                    </span>
                                ) : profileData?.lastActive && (
                                    <span className="bg-gray-800/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                                        {(() => {
                                            const last = profileData.lastActive?.toDate ? profileData.lastActive.toDate() : new Date(profileData.lastActive);
                                            const diff = Math.floor((Date.now() - last.getTime()) / 60000);
                                            if (diff < 60) return `${diff}m ago`;
                                            if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
                                            return `${Math.floor(diff / 1440)}d ago`;
                                        })()}
                                    </span>
                                )}

                                {/* Premium Activity Ribbons */}
                                {isNewMember && (
                                    <span className="bg-emerald-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow border border-white/20">
                                        <Sparkles className="w-2.5 h-2.5" /> NEW
                                    </span>
                                )}
                                {isHighlyResponsive && (
                                    <span className="bg-amber-500/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow border border-white/20">
                                        <Clock className="w-2.5 h-2.5" /> RESPONSIVE
                                    </span>
                                )}
                                {isVerifiedContributor && (
                                    <span className="bg-rose-600/90 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow border border-white/20">
                                        <ShieldCheck className="w-2.5 h-2.5" /> 100% COMPLETE
                                    </span>
                                )}
                            </div>

                            {!canZoom && (
                                <div className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow border border-white/20">
                                    <Lock className="w-3 h-3 text-white/90" />
                                    <span className="text-white text-[9px] font-bold whitespace-nowrap uppercase tracking-wider">Unlocks after acceptance</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            {isItsVerified && (
                                <div className="flex items-center gap-1 bg-gradient-to-r from-[#D4AF37] to-[#B38F00] text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow border border-white/30">
                                    <ShieldCheck className="w-2.5 h-2.5" /> ITS VERIFIED
                                </div>
                            )}
                            {videoStatus === 'verified' && (
                                <div className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full shadow border border-white/30">
                                    <Video className="w-2.5 h-2.5" /> VIDEO VERIFIED
                                </div>
                            )}
                            <button
                                onClick={handleToggleBookmark}
                                className={`p-1.5 rounded-full shadow transition-all ${isBookmarked ? 'bg-[#881337] text-white' : 'bg-white/80 text-gray-500 hover:bg-white'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Video Intro Play Button */}
                    {videoIntroUrl && !showVideoIntro && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowVideoIntro(true); }}
                            className="absolute bottom-24 right-4 z-40 bg-black/40 backdrop-blur-xl border border-white/20 p-4 rounded-full text-white shadow-2xl hover:scale-110 active:scale-95 transition-all group overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#881337]/40 to-[#D4AF37]/40 opacity-100 group-hover:opacity-70 transition-opacity" />
                            <PauseCircle className="w-6 h-6 relative z-10 rotate-90" />
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white"></span>
                            </span>
                        </button>
                    )}

                    {/* Video Intro Modal Overlay */}
                    {showVideoIntro && (
                        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setShowVideoIntro(false); }} 
                                className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md z-[110]"
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <div className="w-full h-full relative">
                                <video 
                                    src={videoIntroUrl} 
                                    autoPlay 
                                    loop 
                                    className="w-full h-full object-cover"
                                    playsInline
                                />
                                <div className="absolute bottom-24 left-8 right-8 pointer-events-none">
                                    <p className="text-white font-black text-2xl drop-shadow-lg mb-2">{firstName}'s Digital Handshake</p>
                                    <p className="text-white/80 text-sm drop-shadow-md">Video Intro • 15 Secs</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 z-30 px-4 pb-3 pt-8">
                        <div className="flex items-end justify-between gap-2">
                            <div>
                                <h3 className="text-white font-black text-xl font-serif leading-tight drop-shadow">
                                    {displayName}, {age}
                                </h3>
                            </div>
                            <div className={`px-2.5 py-1.5 rounded-xl text-xs font-black shadow-lg shrink-0
                                ${requestStatus === 'accepted' ? 'bg-[#D4AF37] text-white' : rejectCount > 0 ? 'bg-red-500 text-white' : 'bg-black/50 text-[#D4AF37] backdrop-blur-sm'}`}>
                                {requestStatus === 'accepted' ? '✓ Accepted' : `${matchScore}% Match`}
                            </div>
                        </div>
                    </div>

                    {/* Photo count indicator */}
                    {photos.length > 1 && (
                        <div className="absolute top-3 right-12 bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 z-30 shadow-lg">
                            <Layers className="w-3 h-3 text-[#D4AF37]" />
                            <span>{photos.length}</span>
                        </div>
                    )}

                    {/* Mobile Friendly Navigation Overlays */}
                    {photos.length > 1 && (
                        <>
                            <div
                                onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((activePhotoIdx - 1 + photos.length) % photos.length); }}
                                className="absolute left-0 top-0 bottom-0 w-1/3 z-40 cursor-pointer flex items-center justify-start pl-2 group"
                            >
                                <div className="bg-black/20 backdrop-blur-sm p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronLeft className="w-5 h-5" />
                                </div>
                            </div>
                            <div
                                onClick={(e) => { e.stopPropagation(); setActivePhotoIdx((activePhotoIdx + 1) % photos.length); }}
                                className="absolute right-0 top-0 bottom-0 w-1/3 z-40 cursor-pointer flex items-center justify-end pr-2 group"
                            >
                                <div className="bg-black/20 backdrop-blur-sm p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Gallery dots - Mobile Optimized */}
                    {photos.length > 1 && (
                        <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1.5 z-40">
                            {photos.map((_, idx) => (
                                <div key={idx}
                                    className={`h-1 rounded-full transition-all duration-300 ${activePhotoIdx === idx ? 'bg-[#D4AF37] w-4' : 'bg-white/40 w-1.5'}`} />
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 flex flex-col gap-3 flex-grow">
                    {/* Smart Highlights */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Preference :</p>
                        <div className="flex flex-wrap gap-2">
                            {(bio?.toLowerCase().includes('hafiz') || education?.toLowerCase().includes('hafiz')) && (
                                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100 shadow-sm transition-transform hover:scale-105">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Hafiz</span>
                                </div>
                            )}
                            {(education?.toLowerCase().includes('graduate') || education?.toLowerCase().includes('mba') || education?.toLowerCase().includes('master')) && (
                                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-100 shadow-sm transition-transform hover:scale-105">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Educated</span>
                                </div>
                            )}
                            {(city?.toLowerCase().includes('mumbai') || jamaat?.toLowerCase().includes('mumbai')) && (
                                <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-100 shadow-sm transition-transform hover:scale-105">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Mumbai Location</span>
                                </div>
                            )}
                            {(bio?.toLowerCase().includes('settled') || professionType?.toLowerCase().includes('settled')) && (
                                <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-100 shadow-sm transition-transform hover:scale-105">
                                    <span className="text-[10px] font-black uppercase tracking-widest">Well Settled</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 🔊 Voice Intro Playback */}
                    {voiceIntroUrl && (
                        <div 
                            onClick={toggleVoicePlay}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all cursor-pointer active:scale-95 shadow-sm
                            ${isPlayingVoice ? 'bg-[#881337] border-[#881337] text-white' : 'bg-rose-50 border-rose-100 text-[#881337] hover:bg-rose-100'}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPlayingVoice ? 'bg-white/20' : 'bg-[#881337] text-white'}`}>
                                {isPlayingVoice ? (
                                    <PauseCircle className="w-5 h-5" />
                                ) : (
                                    <div className="flex items-center gap-0.5">
                                        <div className="w-0.5 h-3 bg-white rounded-full animate-[bounce_1s_infinite]" />
                                        <div className="w-0.5 h-4 bg-white rounded-full animate-[bounce_1.2s_infinite]" />
                                        <div className="w-0.5 h-2 bg-white rounded-full animate-[bounce_0.8s_infinite]" />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${isPlayingVoice ? 'text-white/80' : 'text-[#881337]/60'}`}>
                                    {isPlayingVoice ? 'Now Playing' : 'Voice Intro'}
                                </span>
                                <span className="text-xs font-bold">Hear {firstName}'s Introduction</span>
                            </div>
                            {isPlayingVoice && (
                                <div className="ml-auto w-12 h-4 flex items-center gap-0.5">
                                    {[1,2,3,4,5].map(i => (
                                        <div key={i} className={`flex-1 bg-white rounded-full animate-pulse`} style={{ height: `${Math.random()*100}%`, animationDelay: `${i*0.1}s` }} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {bio && (
                        <div className="bg-[#D4AF37]/5 border-l-4 border-[#D4AF37] p-3 rounded-r-xl relative overflow-hidden group/bio">
                            <div className="absolute top-0 right-0 p-1 opacity-10">
                                <Sparkles className="w-8 h-8 text-[#D4AF37]" />
                            </div>
                            <p className="text-[13px] text-[#881337] font-serif italic leading-relaxed line-clamp-2 relative z-10 transition-colors group-hover/bio:text-black">
                                "{bio}"
                            </p>
                        </div>
                    )
                    }

                    {/* Details grid — always visible, no collapsible */}
                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { label: 'Education', value: education || educationDetails },
                            { label: 'Profession', value: professionType },
                            { label: 'Marital', value: maritalStatus || 'Single' },
                            { label: 'Height', value: heightFeet ? `${heightFeet}'${heightInch || '0'}"` : null },
                            { label: 'City', value: city || location || hizratLocation },
                            { label: 'DOB', value: dob },
                            {
                                label: 'Created', value: createdAt ? (() => {
                                    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
                                    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                })() : null
                            },
                        ].filter(d => d.value).map(d => (
                            <div key={d.label} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{d.label}</p>
                                <p className="text-xs font-bold text-gray-700 truncate">{d.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Parents */}
                    {
                        (fatherName || motherName) && (
                            <div className="bg-rose-50/50 rounded-xl px-3 py-2 border border-rose-100/50">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Parents</p>
                                <p className="text-xs font-semibold text-gray-600">
                                    Father: <span className="text-[#881337]">{fatherName || 'N/A'}</span>
                                    {' '}&nbsp;|&nbsp;{' '}
                                    Mother: <span className="text-[#881337]">{motherName || 'N/A'}</span>
                                </p>
                            </div>
                        )
                    }

                    {/* Partner qualities */}
                    {
                        partnerQualities && (
                            <div className="text-xs text-gray-500 italic border-l-2 border-[#D4AF37] pl-2.5 leading-relaxed mt-2.5">
                                <span className="font-bold text-[#881337] not-italic mr-1 text-[11px]">PP =</span>"{partnerQualities}"
                            </div>
                        )
                    }

                    {/* Contact — only after accepted */}
                    {
                        requestStatus === 'accepted' && (
                            <div className="bg-emerald-50 rounded-xl px-3 py-2.5 border border-emerald-200">
                                <p className="text-[8px] font-black text-emerald-700 uppercase tracking-wider mb-1">✓ Contact Shared</p>
                                {mobile && <p className="text-xs font-bold text-emerald-700">📞 {mobileCode} {mobile}</p>}
                                {email && <p className="text-xs font-bold text-emerald-700">✉️ {email}</p>}
                            </div>
                        )
                    }

                    {/* Profile link */}
                    <button
                        onClick={(e) => { e.stopPropagation(); router.push(`/profile?id=${id}`); }}
                        className="text-[10px] font-bold text-[#881337]/60 hover:text-[#881337] flex items-center gap-1 mx-auto transition-colors mt-2 mb-2 relative z-40">
                        <ExternalLink className="w-3 h-3" /> View Full Profile
                    </button>

                    {/* CTA Button */}
                    {
                        rejectCount >= 2 && !requestSent ? (
                            <div className="w-full py-3 bg-gray-50 text-gray-400 font-bold rounded-xl border border-gray-100 text-xs text-center">
                                Request limit reached for this profile
                            </div>
                        ) : !isMyProfileVerified ? (
                            <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                                <p className="text-amber-800 font-bold text-xs">🔐 Your ITS Verification required to send requests</p>
                                <p className="text-amber-600 text-[10px] mt-0.5">Awaiting admin approval</p>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                {((localIsIncoming ?? isIncomingRequest) && requestStatus?.includes('pending')) ? (
                                    <>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onAcceptInterest && requestId) onAcceptInterest(requestId);
                                            }}
                                            className="flex-[2] py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md active:scale-95 flex items-center justify-center gap-2 animate-pulse hover:shadow-lg transition-all"
                                        >
                                            🤝 Accept Interest
                                        </button>
                                        <button
                                            onClick={handleDeclineClick}
                                            disabled={loading}
                                            className="flex-1 py-3.5 rounded-xl font-black text-xs bg-slate-50 text-slate-500 border border-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <>Reject</>}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isMyProfileVerified && !requestSent) {
                                                setShowIcebreakerModal(true);
                                            } else if (!requestSent) {
                                                handleSendRequest();
                                            }
                                        }}
                                        disabled={(requestSent && requestStatus !== 'accepted' && requestStatus !== 'rejected') || loading || (requestStatus === 'accepted') || isRejectedRecipient}
                                        className={`w-full py-3.5 rounded-xl font-black text-sm transition-all shadow-md active:scale-95 flex items-center justify-center gap-2
                                        ${requestStatus === 'accepted'
                                            ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-white border-none shadow-lg'
                                            : isRejectedRecipient
                                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none'
                                                : requestSent
                                                    ? 'bg-amber-50 text-amber-600 border border-amber-200 shadow-none'
                                                    : rejectCount > 0
                                                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-700 text-white hover:shadow-lg'
                                                        : 'bg-gradient-to-r from-[#881337] to-[#9F1239] text-white hover:shadow-lg'}`}
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {requestStatus === 'accepted' ? '✓ Connected & Chatting'
                                            : isRejectedRecipient ? 'Not Interested'
                                                : (requestSent && (localIsIncoming ?? isIncomingRequest) === false) ? '✓ Interest Sent'
                                                    : rejectCount > 0 ? '↩ Retry Request'
                                                        : 'Send Interest'}
                                    </button>
                                )}
                            </div>
                        )}
                </div>
            </div>

            {/* Icebreaker Modal */}
            {
                showIcebreakerModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowIcebreakerModal(false)}>
                        <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl font-bold font-serif text-[#881337] mb-2">Send Interest Request</h3>
                            <p className="text-sm text-gray-500 mb-4 leading-relaxed">An optional halal icebreaker increases your chances of being accepted!</p>
                            <textarea
                                value={icebreakerText}
                                onChange={e => setIcebreakerText(e.target.value)}
                                placeholder="e.g. I see we both value our Deeni & Dunyawi balance..."
                                className={`w-full bg-gray-50 border ${icebreakerError ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#D4AF37]'} rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 text-sm mb-2 h-24`}
                                maxLength={120}
                            />
                            {icebreakerError && <p className="text-red-500 text-[10px] font-black uppercase tracking-tight mb-3 ml-1 animate-in fade-in">{icebreakerError}</p>}
                            <div className="flex gap-3">
                                <button onClick={() => setShowIcebreakerModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 text-sm">Cancel</button>
                                <button 
                                    onClick={handleSendRequest} 
                                    disabled={!!icebreakerError}
                                    className={`flex-1 py-3 ${!!icebreakerError ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-[#D4AF37] text-white hover:bg-[#c29e2f]'} rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all`}
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Lightbox */}
            {
                showLightbox && canZoom && currentPhoto && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={() => setShowLightbox(false)}>
                        <button
                            className="absolute top-6 right-6 z-[110] w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#881337] shadow-2xl hover:scale-110 transition-all"
                            onClick={e => { e.stopPropagation(); setShowLightbox(false); }}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                            <img src={currentPhoto} alt="Full View" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                            {photos.length > 1 && (
                                <>
                                    <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(prev => (prev - 1 + photos.length) % photos.length); }} className="absolute left-2 md:-left-16 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(prev => (prev + 1) % photos.length); }} className="absolute right-2 md:-right-16 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                    </button>
                                </>
                            )}
                            <div className="absolute -bottom-10 left-0 right-0 text-center text-white/50 text-sm font-bold tracking-widest uppercase">
                                Photo {activePhotoIdx + 1} of {photos.length}
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}
