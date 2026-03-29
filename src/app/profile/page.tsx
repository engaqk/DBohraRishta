"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, Lock, Sparkles, User, Mail, Phone, Heart, Send, X, CheckCircle, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { notifyInterestSent } from '@/lib/emailService';
import { computeMatchScore } from '@/lib/matchUtils';


function ProfileContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { user } = useAuth();
    const id = searchParams?.get('id') || '';

    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [requestStatus, setRequestStatus] = useState<string | null>(null);
    const [requestSent, setRequestSent] = useState(false);
    const [rejectCount, setRejectCount] = useState(0);
    const [isMyProfileVerified, setIsMyProfileVerified] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [viewerItsNumber, setViewerItsNumber] = useState('');
    const [viewerProfile, setViewerProfile] = useState<any>(null);
    const [showInterestModal, setShowInterestModal] = useState(false);
    const [icebreaker, setIcebreaker] = useState('');
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                let meData: any = null;
                if (user) {
                    const meDoc = await getDoc(doc(db, 'users', user.uid));
                    if (meDoc.exists()) {
                        meData = meDoc.data();
                        setViewerProfile(meData);
                        setIsMyProfileVerified(meData.status === 'verified' || meData.status === 'approved' || meData.isItsVerified === true);
                        setViewerItsNumber(meData.itsNumber || '');
                    }
                }

                    if (id) {
                        let profileData: any = null;
                        const profileDoc = await getDoc(doc(db, 'users', id));
                        if (profileDoc.exists()) profileData = profileDoc.data();
                    if (!profileData) { toast.error('Profile not found'); router.push('/'); return; }
                    setProfile(profileData);

                    if (user) {
                        // Check request status
                        const qOut = query(collection(db, 'rishta_requests'), where('from', '==', user.uid), where('to', '==', id));
                        const qIn = query(collection(db, 'rishta_requests'), where('from', '==', id), where('to', '==', user.uid));
                        const [sOut, sIn] = await Promise.all([getDocs(qOut), getDocs(qIn)]);
                        let active = false; let rejects = 0; let status: string | null = null;
                        const check = (d: any) => {
                            const s = d.data().status;
                            if (s === 'rejected' || s === 'ended') { rejects++; }
                            else { active = true; status = s; }
                        };
                        sOut.forEach(check); sIn.forEach(check);
                        setRequestSent(active); setRejectCount(rejects); setRequestStatus(status);

                        // 👁️ Record Profile View (if not me and NOT impersonating)
                        const isImpersonating = typeof window !== 'undefined' ? sessionStorage.getItem('impersonate_user_id') : null;
                        
                        if (user.uid !== id && meData && !isImpersonating) {
                            const viewRef = collection(db, 'profile_views');
                            const viewKey = `${user.uid}_${id}`;
                            addDoc(viewRef, {
                                viewerId: user.uid,
                                viewerName: meData.name || 'Anonymous',
                                viewerLibasUrl: meData.libasImageUrl || null,
                                profileId: id,
                                timestamp: serverTimestamp(),
                                viewKey: viewKey
                            }).catch(e => console.error("Error logging profile view", e));

                            // Increment view count on target profile
                            updateDoc(doc(db, 'users', id), {
                                viewsCount: increment(1)
                            }).catch(() => {});
                        }
                    }
                }
            } catch (e) {
                toast.error('Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [user, id, router]);

    const isAccepted = requestStatus === 'accepted';
    const isFemale = profile?.gender === 'female';
    const canZoom = profile && (profile.isBlurSecurityEnabled === false || isAccepted || !isFemale);

    // 🔒 Hide female surname until accepted
    const displayName = (() => {
        if (!profile) return '';
        const isFemale = profile.gender === 'female';
        if (isFemale && !isAccepted) {
            // Show only first name
            const firstName = profile.firstName || profile.name?.split(' ')[0] || profile.name || '';
            return `${firstName} ●●●●`;
        }
        return profile.name || profile.firstName || '';
    })();

    const photos = [
        profile?.libasImageUrl, 
        profile?.extraImageUrl,
        (profile?.isPhotoVerified || profile?.selfieStatus === 'verified' ? profile?.selfieImageUrl : null)
    ].filter(Boolean) as string[];
    const currentPhoto = photos[activePhotoIdx] || null;
    const age = profile?.dob ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / 31557600000) : null;

    // 🤖 AI Compatibility Engine
    const matchScore = useMemo(() => {
        if (!viewerProfile || !profile || user?.uid === id) return null;
        return computeMatchScore(viewerProfile, profile);
    }, [viewerProfile, profile, id, user?.uid]);

    // 💌 Icebreaker Content Validation
    const icebreakerError = useMemo(() => {
        if (!icebreaker) return null;
        if (icebreaker.length > 160) return "Message too long (max 160)";
        if (icebreaker.includes('@')) return "Email addresses are not allowed for security";
        const digits = icebreaker.replace(/\D/g, '');
        if (digits.length >= 8) return "Phone numbers/Contact info not allowed";
        const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
        if (linkPattern.test(icebreaker)) return "Website links are not allowed";
        return null;
    }, [icebreaker]);

    const handleSendRequest = () => {
        if (!user || !id) return;
        if (!isMyProfileVerified) { toast.error('Your ITS must be verified before sending requests'); return; }
        setShowInterestModal(true);
    };

    const executeRequestSubmission = async () => {
        if (!user || !id) return;
        if (icebreakerError) { toast.error(icebreakerError); return; }

        try {
            setActionLoading(true);
            const spamQ = query(collection(db, 'rishta_requests'), where('from', '==', user.uid));
            const spamSnap = await getDocs(spamQ);
            let recent = 0; const cutoff = Date.now() - 86400000;
            spamSnap.forEach(d => {
                const ts = d.data().timestamp?.toDate?.()?.getTime?.() || 0;
                if (ts > cutoff) recent++;
            });
            if (recent >= 20) { toast.error('Max 20 requests per 24 hours', { icon: '🛡️' }); return; }

            const isImpersonating = typeof window !== 'undefined' ? sessionStorage.getItem('impersonate_user_id') : null;

            await addDoc(collection(db, 'rishta_requests'), {
                from: user.uid, to: id, status: 'pending_response',
                icebreaker: icebreaker || '', 
                timestamp: serverTimestamp(),
            });

            // Increment interest count on target profile (only if not admin/impersonating)
            if (!isImpersonating) {
                await updateDoc(doc(db, 'users', id), {
                    interestsCount: increment(1)
                }).catch(() => {});
            }

            if (profile?.email) {
                notifyInterestSent({
                    senderName: user.displayName || user.email || 'A Participant',
                    senderEmail: user.email || '',
                    recipientEmail: profile.email,
                    recipientName: displayName,
                }).catch(() => { });

                // --- 🔔 In-App Notification to Recipient ---
                await addDoc(collection(db, 'users', id, 'notifications'), {
                    type: 'interest_received',
                    title: 'NEW INTEREST REQUEST',
                    message: `${user.displayName || 'A Candidate'} has sent you an interest request. Login to your dashboard to review.`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });
            }

            setRequestSent(true);
            toast.success('Interest request sent!');
            setShowInterestModal(false);
        } catch (e: any) {
            toast.error('Failed: ' + e.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-[#881337] animate-spin" />
        </div>
    );

    if (!profile) return (
        <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center text-gray-400 font-bold">Profile Not Found</div>
    );

    const { jamaat, location, hizratLocation, libasImageUrl, extraImageUrl, gender,
        hobbies, partnerQualities, bio, isItsVerified, heightFeet, heightInch,
        maritalStatus, educationDetails, education, professionType, fatherName,
        motherName, city, state, country, mobile, mobileCode, email, dob,
        siblings, noOfChildren, citizenOf, ancestralWatan, address,
        hifzStatus, completedUpto, serviceType, employmentDetails, isPhotoVerified } = profile || {};

    if (!user) {
        return (
            <div className="min-h-screen bg-[#fcf8f9] flex flex-col items-center select-none pb-20">
                {/* Premium Branding Header (Unified with Dashboard) */}
                <div className="w-full bg-[#881337] pt-16 pb-12 text-center relative overflow-hidden border-b-4 border-[#D4AF37]/20 shadow-2xl">
                    {/* Background Texture/Sparkles */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -tr-32 -tt-32" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#D4AF37]/30 rounded-full blur-3xl -bl-32 -bb-32" />
                    </div>

                    <p className="relative z-10 text-[9px] font-black tracking-[0.7em] text-white/40 uppercase mb-8">https://53dbohrarishta.in</p>
                    
                    {/* 53 Badge (Unified Style) */}
                    <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center z-10">
                        <div className="absolute inset-0 bg-[#D4AF37]/40 rounded-full blur-2xl animate-pulse scale-150" />
                        <div className="relative w-24 h-24 rounded-full border-[3px] border-[#D4AF37] bg-white flex items-center justify-center shadow-[0_15px_35px_rgba(0,0,0,0.4)]">
                            <span className="text-5xl font-black text-[#D4AF37] font-serif tracking-tighter">53</span>
                        </div>
                    </div>

                    <h1 className="relative z-10 text-5xl font-black tracking-tight mb-4 text-white font-serif drop-shadow-lg">
                        DBohra<span className="text-[#D4AF37]">Rishta</span>
                    </h1>

                    <div className="relative z-10 flex items-center justify-center gap-4 mt-2">
                        <div className="h-[1.5px] w-20 bg-white/20" />
                        <p className="text-[12px] font-sans font-black tracking-[0.5em] uppercase text-white/80">Intelligent Matches</p>
                        <div className="h-[1.5px] w-20 bg-white/20" />
                    </div>
                </div>

                {/* Digital BioData Preview (Unified with Dashboard Layout) */}
                <div className="w-full max-w-[540px] -mt-8 bg-white rounded-[3rem] shadow-[0_45px_100px_-20px_rgba(136,19,55,0.25)] border border-white/50 overflow-hidden relative group p-1 z-30">
                    <div className="p-8 md:p-10 relative z-10 bg-white rounded-[2.8rem]">
                        
                        {/* Status Label (Bio Preview) */}
                        <div className="flex items-center justify-center gap-4 mb-10">
                            <div className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent to-[#D4AF37]/30" />
                            <h2 className="text-[14px] font-black uppercase tracking-[0.4em] text-[#881337]/60">Digital BioData</h2>
                            <div className="h-[1.5px] flex-1 bg-gradient-to-l from-transparent to-[#D4AF37]/30" />
                        </div>

                        <div className="flex flex-col md:flex-row gap-8 mb-10">
                            {/* Photo Section (Blurred for safety) */}
                            <div className="w-44 h-56 mx-auto md:mx-0 rounded-[35px] overflow-hidden ring-8 ring-rose-50/50 shadow-2xl shrink-0 relative bg-gray-50 border border-rose-100">
                                {profile.libasImageUrl ? (
                                    <img src={profile.libasImageUrl} className="w-full h-full object-cover blur-[8px] scale-110 opacity-60" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-200"><User size={64} /></div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-white/40 to-transparent" />
                                <div className="absolute top-3 left-0 right-0 px-3">
                                    <div className="px-2 py-1 bg-white/80 backdrop-blur-md rounded-lg text-[8px] font-black text-[#881337] uppercase tracking-widest text-center shadow-sm">Photo Locked</div>
                                </div>
                            </div>

                            <div className="flex-1 pt-2">
                                <h2 className="text-3xl font-black text-gray-900 font-serif mb-2 leading-tight">
                                    {profile.name?.split(' ')[0] || 'Member'} ●●●●
                                </h2>
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 mb-6 shadow-sm">
                                    <ShieldCheck size={14} className="fill-emerald-800/10" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">ITS Verified Member</span>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4 text-center">
                                        <div className="flex flex-col p-3 bg-gray-50 rounded-2xl border border-gray-100/50">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Age</span>
                                            <span className="text-sm font-black text-gray-800">{profile.dob ? `${new Date().getFullYear() - new Date(profile.dob).getFullYear()} Years` : 'N/A'}</span>
                                        </div>
                                        <div className="flex flex-col p-3 bg-gray-50 rounded-2xl border border-gray-100/50">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Status</span>
                                            <span className="text-sm font-black text-gray-800">{profile.maritalStatus || 'Single'}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3.5 bg-rose-50/40 rounded-2xl border border-rose-100/30">
                                        <MapPin size={14} className="text-[#881337] opacity-60" />
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-gray-400 uppercase">Current Home</span>
                                            <span className="text-xs font-bold text-gray-800">{profile.location || profile.hizratLocation || profile.city || 'Confidential'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio teaser / Profile Highlights */}
                        <div className="mb-10 p-6 bg-[#fdf2f4] rounded-[30px] border border-rose-100 shadow-inner relative overflow-hidden">
                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-[#881337]/5 rounded-full pointer-events-none" />
                            <p className="text-sm text-[#881337] font-serif italic leading-relaxed text-center font-medium">
                                &ldquo;{profile.bio && profile.bio.length > 120 ? `${profile.bio.substring(0, 120)}...` : profile.bio || "Searching for a compatible match who values deen and family traditions."}&rdquo;
                            </p>
                        </div>

                        {/* Bottom CTA Block */}
                        <div className="text-center pt-4 border-t border-gray-100 mt-2">
                             <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-50 rounded-full text-amber-800 border-2 border-amber-200 mb-8 mx-auto shadow-sm">
                                <Lock size={16} className="fill-amber-800/10" />
                                <span className="text-[11px] font-black uppercase tracking-widest">Full Biodata Locked</span>
                            </div>
                            
                            <h3 className="text-2xl font-black text-[#881337] font-serif mb-3">View Full Profile?</h3>
                            <p className="text-gray-500 text-sm mb-10 max-w-[340px] mx-auto leading-relaxed font-medium">
                                Direct contact information, ancestral details, and professional background are protected for user privacy.
                            </p>

                            <button 
                                onClick={() => router.push('/login')}
                                className="w-full py-5 bg-[#881337] text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.25em] shadow-[0_25px_50px_-12px_rgba(136,19,55,0.4)] hover:shadow-[0_30px_60px_-12px_rgba(136,19,55,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                <Sparkles size={20} />
                                Login to View Details
                            </button>
                            
                            <p className="mt-8 text-xs text-gray-400 font-bold">
                                Not a member? <button onClick={() => router.push('/login')} className="text-[#D4AF37] border-b-2 border-[#D4AF37]/30 hover:border-[#D4AF37] pb-0.5 tracking-wide transition-all">Create your Biodata</button>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Branding */}
                <div className="mt-16 text-center opacity-30 group cursor-default">
                    <p className="text-[12px] font-black text-[#881337] uppercase tracking-[0.5em] group-hover:tracking-[0.8em] transition-all">
                        53DBOHRARISHTA.IN
                    </p>
                    <p className="text-[9px] text-[#881337] font-black mt-2">Intelligent Matching System</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            {/* Impersonation Banner */}
            {typeof window !== 'undefined' && sessionStorage.getItem('impersonate_user_id') && (
                <div className="bg-red-600 text-white px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 shadow-inner sticky top-0 z-[100]">
                    <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3 h-3" /> IMPERSONATION MODE ACTIVE
                    </span>
                    <button 
                        onClick={() => {
                            sessionStorage.removeItem('impersonate_user_id');
                            window.location.href = '/admin/users';
                        }}
                        className="bg-white text-red-600 px-3 py-1 rounded-full font-black hover:bg-red-50 transition-colors"
                    >
                        Return to Admin
                    </button>
                </div>
            )}

            {/* Sticky Nav */}
            <div className={`bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40 ${typeof window !== 'undefined' && sessionStorage.getItem('impersonate_user_id') ? 'mt-0' : ''}`}>
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-500 hover:text-[#881337] font-bold transition-colors text-sm">
                        <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <p className="font-serif font-bold text-[#881337]">Profile Details</p>
                    <div className="w-16" />
                </div>
            </div>

            <main className="max-w-2xl mx-auto px-3 py-5 pb-16">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">

                    {/* ── HERO PHOTO ── */}
                    <div className="relative h-80 bg-gray-200 overflow-hidden">
                        {currentPhoto ? (
                            <>
                                <img
                                    src={currentPhoto}
                                    alt="Profile"
                                    onClick={() => { if (canZoom) setShowLightbox(true); }}
                                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-500
                                        ${canZoom ? 'cursor-zoom-in filter-none scale-100' : 'blur-[5px] scale-105'}`}
                                />
                                {/* Dark overlay reinforces blur privacy effect */}
                                {!canZoom && (
                                    <div className="absolute inset-0 bg-black/10 z-10 pointer-events-none" />
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                <span className="text-6xl opacity-30">👤</span>
                            </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-20 pointer-events-none" />

                        {/* Top badges */}
                        <div className="absolute top-3 left-3 z-30 flex flex-col items-start gap-2">
                            {!canZoom && currentPhoto && (
                                <div className="bg-black/60 backdrop-blur-md rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow border border-white/20">
                                    <ShieldCheck className="w-3 h-3 text-white/90" />
                                    <span className="text-white text-[9px] font-bold whitespace-nowrap uppercase tracking-wider">Unlocks after acceptance</span>
                                </div>
                            )}
                        </div>

                        {/* Top badges */}
                        <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
                            {isItsVerified && (
                                <div className="flex items-center gap-1 bg-gradient-to-r from-[#D4AF37] to-[#B38F00] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow border border-white/30">
                                    <ShieldCheck className="w-3 h-3" /> ITS Verified
                                </div>
                            )}
                            {isAccepted && (
                                <div className="flex items-center gap-1 bg-[#D4AF37] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow">
                                    ✓ Connection Accepted
                                </div>
                            )}
                        </div>

                        {/* Name overlay */}
                        <div className="absolute bottom-0 left-0 right-0 z-30 px-5 pb-4">
                            <div className="flex items-end justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-white font-black text-2xl font-serif leading-tight drop-shadow">
                                            {displayName}{age ? `, ${age}` : ''}
                                        </h1>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                        <div className="bg-[#D4AF37]/20 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-lg">
                                            <p className="text-white text-[11px] font-black uppercase tracking-widest leading-none">
                                                {jamaat || city || 'Bohra Community'} • {location || hizratLocation || 'Global'}
                                            </p>
                                        </div>
                                        {matchScore !== null && (
                                            <div className="bg-emerald-500/20 backdrop-blur-sm border border-emerald-400/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg group relative">
                                                <Heart className="w-2.5 h-2.5 text-emerald-300 fill-emerald-300" />
                                                <p className="text-emerald-50 text-[10px] font-black uppercase tracking-widest leading-none">
                                                    {matchScore}% Match
                                                </p>
                                            </div>
                                        )}
                                        {isPhotoVerified && (
                                            <div className="bg-blue-500/20 backdrop-blur-sm border border-blue-400/30 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg">
                                                <ShieldCheck className="w-2.5 h-2.5 text-blue-300 fill-blue-300" />
                                                <p className="text-blue-50 text-[10px] font-black uppercase tracking-widest leading-none">
                                                    Selfie Verified
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Gallery dots */}
                            {photos.length > 1 && (
                                <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-2 z-30">
                                    {photos.map((_, idx) => (
                                        <button key={idx} onClick={() => setActivePhotoIdx(idx)}
                                            className={`w-2 h-2 rounded-full transition-all ${activePhotoIdx === idx ? 'bg-[#D4AF37] w-4' : 'bg-white/50 hover:bg-white'}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── DETAILS ── */}
                    <div className="p-4 flex flex-col gap-4">
                        {/* Premium Highlights Section */}
                        <div className="flex flex-wrap gap-2.5 py-1">
                            {bio?.toLowerCase().includes('hafiz') && (
                                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm animate-in zoom-in duration-300">
                                    <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]">✨</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Holy Quran Hafiz</span>
                                </div>
                            )}
                            {(education?.toLowerCase().includes('graduate') || education?.toLowerCase().includes('mba') || education?.toLowerCase().includes('master')) && (
                                <div className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1.5 rounded-xl border border-blue-100 shadow-sm animate-in zoom-in duration-300 delay-75">
                                    <div className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px]">🎓</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Highly Educated</span>
                                </div>
                            )}
                            {(city?.toLowerCase().includes('mumbai') || jamaat?.toLowerCase().includes('mumbai')) && (
                                <div className="flex items-center gap-2 bg-rose-50 text-rose-800 px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm animate-in zoom-in duration-300 delay-100">
                                    <div className="w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px]">📍</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Mumbai Based</span>
                                </div>
                            )}
                            {bio?.toLowerCase().includes('settled') && (
                                <div className="flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-100 shadow-sm animate-in zoom-in duration-300 delay-150">
                                    <div className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px]">💰</div>
                                    <span className="text-[10px] font-black uppercase tracking-widest leading-none">Well Settled</span>
                                </div>
                            )}
                        </div>

                        {/* Bio / Tagline */}
                        {bio && (
                            <div className="bg-[#D4AF37]/5 border-l-4 border-[#D4AF37] p-4 rounded-r-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <Sparkles className="w-10 h-10 text-[#D4AF37]" />
                                </div>
                                <p className="text-sm text-[#881337] font-serif italic leading-relaxed relative z-10 font-medium">
                                    "{bio}"
                                </p>
                            </div>
                        )}

                        {/* Info grid — always visible, matches DiscoveryCard EXACTLY */}
                        <div className="grid grid-cols-2 gap-1.5">
                            {[
                                { label: 'Education', value: completedUpto || education || educationDetails },
                                { label: 'Profession', value: professionType },
                                { label: 'Marital', value: maritalStatus || 'Single' },
                                { label: 'Height', value: heightFeet ? `${heightFeet}'${heightInch || '0'}"` : null },
                                { label: 'City', value: city || location || hizratLocation },
                                { label: 'DOB', value: dob },
                            ].filter(d => d.value).map(d => (
                                <div key={d.label} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{d.label}</p>
                                    <p className="text-xs font-bold text-gray-700 truncate">{d.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Parents & Family Details */}
                        {(fatherName || motherName || siblings || noOfChildren || citizenOf || ancestralWatan) && (isAccepted || gender !== 'female') && (
                            <div className="bg-rose-50/50 rounded-xl px-3 py-3 border border-rose-100/50 space-y-2">
                                <div>
                                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Parents</p>
                                    <p className="text-xs font-semibold text-gray-600">
                                        Father: <span className="text-[#881337]">{fatherName || 'N/A'}</span>
                                        {' '}&nbsp;|&nbsp;{' '}
                                        Mother: <span className="text-[#881337]">{motherName || 'N/A'}</span>
                                    </p>
                                </div>
                                {(siblings || noOfChildren) && (
                                    <div className="flex gap-4 border-t border-rose-100/50 pt-2">
                                        {siblings && (
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Siblings</p>
                                                <p className="text-xs font-semibold text-gray-600">{siblings}</p>
                                            </div>
                                        )}
                                        {noOfChildren && (
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Children</p>
                                                <p className="text-xs font-semibold text-gray-600">{noOfChildren}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {(citizenOf || ancestralWatan) && (
                                    <div className="flex gap-4 border-t border-rose-100/50 pt-2">
                                        {citizenOf && (
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Citizen Of</p>
                                                <p className="text-xs font-semibold text-gray-600">{citizenOf}</p>
                                            </div>
                                        )}
                                        {ancestralWatan && (
                                            <div>
                                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Ancestral Watan</p>
                                                <p className="text-xs font-semibold text-gray-600">{ancestralWatan}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Education Deep Dive */}
                        {(educationDetails || hifzStatus) && (
                            <div className="bg-blue-50/50 rounded-xl px-3 py-2.5 border border-blue-100/50">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">Education & Deeni Taleem</p>
                                {completedUpto && <p className="text-xs text-gray-700 font-bold mb-1">{completedUpto}</p>}
                                {educationDetails && <p className="text-xs text-gray-600 leading-relaxed mb-1">{educationDetails}</p>}
                                {hifzStatus && <p className="text-xs font-medium text-emerald-700 bg-emerald-100/50 inline-block px-1.5 py-0.5 rounded mt-1">Hifz: {hifzStatus}</p>}
                            </div>
                        )}

                        {/* Occupation Deep Dive */}
                        {(employmentDetails || serviceType) && (
                            <div className="bg-indigo-50/50 rounded-xl px-3 py-2.5 border border-indigo-100/50">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">Occupation Details</p>
                                {serviceType && <p className="text-xs text-gray-700 font-bold mb-1">{serviceType}</p>}
                                {employmentDetails && <p className="text-xs text-gray-600 leading-relaxed">{employmentDetails}</p>}
                            </div>
                        )}

                        {/* Hobbies */}
                        {hobbies && (
                            <div className="bg-blue-50/50 rounded-xl px-3 py-2.5 border border-blue-100/50">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Hobbies & Interests</p>
                                <p className="text-xs text-gray-700 font-medium">{hobbies}</p>
                            </div>
                        )}

                        {/* Partner qualities */}
                        {partnerQualities && (
                            <div className="text-xs text-gray-500 italic border-l-2 border-[#D4AF37] pl-3 leading-relaxed">
                                <span className="font-bold text-[#881337] not-italic mr-1 text-[11px]">PP =</span>"{partnerQualities}"
                            </div>
                        )}

                        {/* General Contact Info (No Mobile/Email) */}
                        {address && (
                            <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100 mt-2">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">General Info</p>
                                <p className="text-xs text-gray-600"><strong>Address:</strong> {address}</p>
                            </div>
                        )}

                        {/* Contact — only after accepted */}
                        {isAccepted && (
                            <div className="bg-emerald-50 rounded-xl px-3 py-3 border border-emerald-200 mt-2">
                                <p className="text-[8px] font-black text-emerald-700 uppercase tracking-wider mb-1.5">✓ Contact Details (Shared)</p>
                                {mobile && <p className="text-sm font-bold text-emerald-700">📞 {mobileCode} {mobile}</p>}
                                {email && <p className="text-sm font-bold text-emerald-700">✉️ {email}</p>}
                            </div>
                        )}

                        {/* Privacy notice if not accepted */}
                        {!canZoom && (
                            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex gap-3 items-start">
                                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-amber-800 text-xs mb-0.5">Privacy Protected</p>
                                    <p className="text-[10px] text-amber-700 leading-relaxed">
                                        Photos remain blurred and surname is hidden until this candidate accepts your interest request.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── CTA BUTTON ── */}
                        <div className="pt-2">
                            {rejectCount >= 2 && !requestSent ? (
                                <div className="w-full py-4 bg-gray-50 text-gray-400 font-bold rounded-xl border border-gray-100 text-sm text-center">
                                    Request limit reached for this profile
                                </div>
                            ) : !isMyProfileVerified ? (
                                <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                                    <p className="text-amber-800 font-bold text-xs">🔐 ITS Verification required to send requests</p>
                                    <p className="text-amber-600 text-[10px] mt-0.5">Awaiting admin approval</p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleSendRequest}
                                    disabled={requestSent || actionLoading}
                                    className={`w-full py-4 rounded-xl font-black text-base transition-all shadow-md active:scale-95 flex items-center justify-center gap-2
                                        ${isAccepted
                                            ? 'bg-emerald-50 text-emerald-600 cursor-not-allowed border border-emerald-200'
                                            : requestSent
                                                ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200'
                                                : 'bg-gradient-to-r from-[#881337] to-[#9F1239] text-white hover:shadow-xl'}`}
                                >
                                    {actionLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                                    {isAccepted ? '✓ Interest Accepted'
                                        : requestSent ? '✓ Request Sent'
                                            : rejectCount === 1 ? '↩ Retry Interest Request'
                                                : 'Send Interest Request'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* ── LIGHTBOX ── */}
            {showLightbox && canZoom && currentPhoto && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" onClick={() => setShowLightbox(false)}>
                    <button onClick={e => { e.stopPropagation(); setShowLightbox(false); }}
                        className="absolute top-5 right-5 w-11 h-11 bg-white rounded-full flex items-center justify-center text-[#881337] shadow-2xl hover:scale-110 transition-all z-10">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="relative max-w-3xl max-h-[90vh] w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img src={currentPhoto} alt="Full view" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
                        {photos.length > 1 && (
                            <>
                                <button onClick={() => setActivePhotoIdx(p => (p - 1 + photos.length) % photos.length)}
                                    className="absolute left-2 md:-left-14 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button onClick={() => setActivePhotoIdx(p => (p + 1) % photos.length)}
                                    className="absolute right-2 md:-right-14 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* 💌 Custom Interest Request Modal (Icebreaker) */}
            {showInterestModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 shadow-2xl animate-in slide-in-from-bottom-8 duration-500 border-t-8 border-[#881337]">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-2xl font-black text-[#881337] font-serif leading-tight">Send Interest</h3>
                            <button onClick={() => setShowInterestModal(false)} className="p-2 hover:bg-rose-50 rounded-full transition-colors">
                                <X className="w-6 h-6 text-[#881337]" />
                            </button>
                        </div>
                        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6 block">Target Profile: {displayName}</p>
                        
                        <div className="space-y-4 mb-8">
                            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100/50">
                                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <Sparkles size={12} /> Why send a personal message?
                                </p>
                                <p className="text-xs text-gray-500 italic">Adding a short icebreaker message helps you stand out and increases the chance of acceptance by 40%. Keep it professional and deeni-centric!</p>
                            </div>

                            <div className="relative">
                                <textarea
                                    value={icebreaker}
                                    onChange={(e) => setIcebreaker(e.target.value)}
                                    placeholder="Introduce yourself briefly (no contact info)... e.g. Assalamu alaykum, I found your education and background alignment very appealing..."
                                    className={`w-full h-40 bg-gray-50/50 border ${icebreakerError ? 'border-rose-300' : 'border-gray-100'} rounded-[1.5rem] p-6 text-sm outline-none focus:ring-4 focus:ring-rose-100 transition-all resize-none font-medium text-gray-700`}
                                    maxLength={160}
                                />
                                <div className={`absolute bottom-4 right-6 text-[10px] font-black ${icebreaker.length > 150 ? 'text-rose-500' : 'text-gray-400'}`}>
                                    {icebreaker.length} / 160
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={executeRequestSubmission}
                                disabled={actionLoading || !!icebreakerError}
                                className="w-full py-5 bg-[#881337] text-white rounded-[1.2rem] font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-900/30 active:scale-95 hover:bg-[#6b0f2c] transition-all disabled:opacity-40 disabled:grayscale flex items-center justify-center gap-3"
                            >
                                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        Confirm & Send Interest <Send size={16} />
                                    </>
                                )}
                            </button>
                            
                            {icebreakerError && (
                                <p className="text-center text-[10px] font-black text-rose-600 bg-rose-50 py-2 rounded-lg border border-rose-100 px-4 animate-bounce">
                                    ⚠️ {icebreakerError}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    return (
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#881337]" /></div>}>
            <ProfileContent />
        </React.Suspense>
    );
}
