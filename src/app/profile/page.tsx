"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, Lock, Sparkles, User, Mail, Phone, Heart, Send, X, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { notifyInterestSent } from '@/lib/emailService';

// Dummy profiles for testing
const DUMMIES: any[] = [
    { id: 'dummy1', name: 'Aliya Taher', firstName: 'Aliya', lastName: 'Taher', gender: 'female', dob: '1998-05-15', jamaat: 'Colpetty Jamaat, Colombo', education: 'MBA in Finance', hizratLocation: 'Colombo, LK', isItsVerified: true, bio: 'I am an ambitious professional balancing deen and dunya.', hobbies: 'Traveling, Cooking', partnerQualities: 'Well-educated with good Deeni understanding.', heightFeet: '5', heightInch: '4', maritalStatus: 'Single' },
    { id: 'dummy2', name: 'Fatima Husain', firstName: 'Fatima', lastName: 'Husain', gender: 'female', dob: '2000-02-10', jamaat: 'Saifee Park Jamaat, Dubai', education: 'Software Engineer', hizratLocation: 'Dubai, UAE', isItsVerified: true, bio: 'Software engineer who loves reading and exploring new tech.', hobbies: 'Reading, Painting', partnerQualities: 'Respectful and financially stable.', heightFeet: '5', heightInch: '6', maritalStatus: 'Single' },
    { id: 'dummy3', name: 'Zahra Moiz', firstName: 'Zahra', lastName: 'Moiz', gender: 'female', dob: '1999-11-20', jamaat: 'Husaini Jamaat, London', education: 'Doctor of Medicine', hizratLocation: 'London, UK', isItsVerified: true, bio: 'Dedicated doctor with a passion for helping others.', hobbies: 'Photography, Swimming', partnerQualities: 'Family-oriented and supportive.', heightFeet: '5', heightInch: '2', maritalStatus: 'Single' },
];

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
                    if (id.startsWith('dummy')) {
                        profileData = DUMMIES.find(d => d.id === id) || null;
                    } else {
                        const profileDoc = await getDoc(doc(db, 'users', id));
                        if (profileDoc.exists()) profileData = profileDoc.data();
                    }
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

                        // 👁️ Record Profile View (if not me)
                        if (user.uid !== id && meData) {
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

    const photos = [profile?.libasImageUrl, profile?.extraImageUrl].filter(Boolean) as string[];
    const currentPhoto = photos[activePhotoIdx] || null;
    const age = profile?.dob ? Math.floor((Date.now() - new Date(profile.dob).getTime()) / 31557600000) : null;

    // 🤖 AI Compatibility Engine
    const matchScore = useMemo(() => {
        if (!viewerProfile || !profile || user?.uid === id) return null;
        let score = 65; // Base community match score
        
        // 🔹 Ancestral Watan Match (+20)
        if (viewerProfile.ancestralWatan && profile.ancestralWatan && 
            viewerProfile.ancestralWatan.toLowerCase().trim() === profile.ancestralWatan.toLowerCase().trim()) {
            score += 20;
        }

        // 🔹 Education Compatibility (+10)
        const getEdLevel = (ed: string) => {
            if (!ed) return 0;
            const e = ed.toLowerCase();
            if (e.includes('doctor') || e.includes('phd')) return 3;
            if (e.includes('master') || e.includes('mba') || e.includes('ms')) return 2;
            if (e.includes('graduate') || e.includes('bachelor')) return 1;
            return 0;
        };
        if (getEdLevel(viewerProfile.education) === getEdLevel(profile.education) && getEdLevel(profile.education) > 0) {
            score += 10;
        }

        // 🔹 Deeni Alignment (+5)
        if (viewerProfile.hifzStatus && profile.hifzStatus && 
            viewerProfile.hifzStatus === profile.hifzStatus) {
            score += 5;
        }

        return Math.min(98, score);
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

        if (id.startsWith('dummy')) {
            setActionLoading(true);
            setTimeout(() => { 
                setRequestSent(true); 
                toast.success('Demo request sent!'); 
                setActionLoading(false); 
                setShowInterestModal(false);
            }, 800);
            return;
        }
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

            await addDoc(collection(db, 'rishta_requests'), {
                from: user.uid, to: id, status: 'pending_response',
                icebreaker: icebreaker || '', 
                timestamp: serverTimestamp(),
            });

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

    const { jamaat, hizratLocation, libasImageUrl, extraImageUrl, gender,
        hobbies, partnerQualities, bio, isItsVerified, heightFeet, heightInch,
        maritalStatus, educationDetails, education, professionType, fatherName,
        motherName, city, state, country, mobile, mobileCode, email, dob,
        siblings, noOfChildren, citizenOf, ancestralWatan, address,
        hifzStatus, completedUpto, serviceType, employmentDetails, isPhotoVerified } = profile || {};

    if (!user) {
        return (
            <div className="min-h-screen bg-[#fcf8f9] flex flex-col items-center py-12 px-4 select-none">
                {/* Premium Branding Header */}
                <div className="text-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                     <p className="text-[8px] font-black tracking-[0.6em] text-[#881337]/30 uppercase mb-8">https://53dbohrarishta.in</p>
                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full font-bold text-3xl bg-gradient-to-br from-white to-rose-100 ring-4 ring-white/20 shadow-[0_0_30px_rgba(212,175,55,0.5)] border-2 border-[#D4AF37]" 
                         style={{ color: '#D4AF37' }}>
                        53
                    </div>
                    <h1 className="text-4xl font-extrabold tracking-tighter mb-1" style={{ color: '#881337', fontFamily: 'serif' }}>
                        DBohra<span style={{ color: '#D4AF37', fontWeight: 'normal', fontStyle: 'italic' }}>Rishta</span>
                    </h1>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <div className="h-[1px] w-8 bg-[#881337]/20" />
                        <p className="text-[10px] font-sans font-black tracking-[0.3em] uppercase text-[#881337]/60">Intelligent Matches</p>
                        <div className="h-[1px] w-8 bg-[#881337]/20" />
                    </div>
                </div>

                {/* Digital Biodata Preview Card */}
                <div className="w-full max-w-[480px] bg-white rounded-[2rem] shadow-[0_30px_60px_-15px_rgba(136,19,55,0.15)] border border-rose-100/50 overflow-hidden relative group">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -ml-16 -mb-16 opacity-50" />

                    <div className="p-8 relative z-10">
                        <div className="flex gap-6 mb-8">
                            <div className="w-32 h-44 rounded-2xl overflow-hidden ring-4 ring-rose-50 shadow-lg shrink-0 grayscale-[0.3]">
                                {profile.libasImageUrl ? (
                                    <img src={profile.libasImageUrl} className="w-full h-full object-cover blur-[4px]" />
                                ) : (
                                    <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300"><User size={48} /></div>
                                )}
                            </div>
                            <div className="flex-1 pt-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-black text-gray-900 font-serif leading-none">{profile.name?.split(' ')[0]} ●●●●</h2>
                                </div>
                                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 mb-4">
                                    <ShieldCheck size={12} className="fill-emerald-700/10" />
                                    <span className="text-[10px] font-black uppercase tracking-wider">ITS Verified Member</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Location</span>
                                        <span className="text-xs font-bold text-gray-700">{profile.hizratLocation || profile.city || 'Confidential'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Occupation</span>
                                        <span className="text-xs font-bold text-gray-700">{profile.professionType || 'Confidential'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bio teaser */}
                        {profile.bio && (
                            <div className="mb-6 p-4 bg-rose-50/50 rounded-2xl border border-rose-100 italic font-serif text-sm text-[#881337] leading-relaxed">
                                &ldquo;{profile.bio.length > 100 ? `${profile.bio.substring(0, 100)}...` : profile.bio}&rdquo;
                            </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Education</p>
                                <p className="text-xs font-bold text-gray-700 truncate">{profile.education || 'Graduate'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Age</p>
                                <p className="text-xs font-bold text-gray-700">{profile.dob ? `${new Date().getFullYear() - new Date(profile.dob).getFullYear()} Years` : 'N/A'}</p>
                            </div>
                        </div>

                        {/* Lock Overlay for restricted data */}
                        <div 
                            className="pt-10 -mt-10 relative z-20 text-center"
                            style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.9) 30%, #ffffff 60%)' }}
                        >
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-full text-amber-700 border border-amber-200 mb-6 mx-auto">
                                <Lock size={14} className="fill-amber-700/10" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Biodata Details Locked</span>
                            </div>
                            
                            <h3 className="text-xl font-black text-[#881337] font-serif mb-2">Interested in this profile?</h3>
                            <p className="text-gray-500 text-xs mb-8 max-w-[280px] mx-auto leading-relaxed">
                                Login to view full details including ancestral watan, family background, and send interest requests.
                            </p>

                            <button 
                                onClick={() => router.push('/login')}
                                className="w-full py-4 bg-[#881337] text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_20px_40px_-10px_rgba(136,19,55,0.4)] hover:shadow-[0_25px_50px_-12px_rgba(136,19,55,0.5)] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Sparkles size={18} className="group-hover:animate-pulse" />
                                Login to View Profile
                            </button>
                            
                            <p className="mt-4 text-[10px] text-gray-400 font-bold">
                                New here? <button onClick={() => router.push('/login')} className="text-[#D4AF37] underline underline-offset-4">Create your own biodata</button>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer Link */}
                <p className="mt-12 text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                    53DBOHRARISHTA.IN
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            {/* Sticky Nav */}
            <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
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
                                                {jamaat || city || 'Bohra Community'} • {hizratLocation || 'Global'}
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
                                                    Verified Profile
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
                                { label: 'City', value: city || hizratLocation },
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
