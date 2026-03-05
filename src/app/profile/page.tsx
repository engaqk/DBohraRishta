"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, Lock } from 'lucide-react';
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
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!user) return;
            try {
                const meDoc = await getDoc(doc(db, 'users', user.uid));
                if (meDoc.exists()) {
                    const me = meDoc.data();
                    setIsMyProfileVerified(me.status === 'verified' || me.status === 'approved' || me.isItsVerified === true);
                    setViewerItsNumber(me.itsNumber || '');
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
    const canZoom = profile && (!profile.isBlurSecurityEnabled || isAccepted);

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

    const handleSendRequest = async () => {
        if (!user || !id) return;
        if (!isMyProfileVerified) { toast.error('Your ITS must be verified before sending requests'); return; }
        if (id.startsWith('dummy')) {
            setActionLoading(true);
            setTimeout(() => { setRequestSent(true); toast.success('Demo request sent!'); setActionLoading(false); }, 800);
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
                icebreaker: '', timestamp: serverTimestamp(),
            });

            if (profile?.email) {
                notifyInterestSent({
                    senderName: user.displayName || user.email || 'A Candidate',
                    recipientEmail: profile.email,
                    recipientName: displayName,
                }).catch(() => { });
            }

            setRequestSent(true);
            toast.success('Interest request sent!');
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
        motherName, city, state, country, mobile, mobileCode, email } = profile;

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
                                        ${canZoom ? 'cursor-zoom-in blur-0 scale-100' : 'blur-[3px] scale-105'}`}
                                />
                                {/* Watermark */}
                                {canZoom && viewerItsNumber && (
                                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-wrap overflow-hidden opacity-[0.06] items-center justify-center">
                                        {Array.from({ length: 30 }).map((_, i) => (
                                            <span key={i} className="text-black font-extrabold text-sm whitespace-nowrap px-4 py-6 -rotate-45 select-none">{viewerItsNumber}</span>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                                <span className="text-6xl opacity-30">👤</span>
                            </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent z-20 pointer-events-none" />

                        {/* Privacy pill */}
                        {!canZoom && currentPhoto && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-white/80" />
                                <span className="text-white text-xs font-bold whitespace-nowrap">Unlocks after acceptance</span>
                            </div>
                        )}

                        {/* Top badges */}
                        <div className="absolute top-3 right-3 z-30 flex flex-col items-end gap-2">
                            {isItsVerified && (
                                <div className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow border border-white/30">
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
                                        {gender === 'female' && !isAccepted && (
                                            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm text-white/70 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                <Lock className="w-2.5 h-2.5" /> Surname hidden
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-white/70 text-xs font-medium mt-0.5">
                                        {jamaat || 'Bohra Community'} • {hizratLocation || city || 'Global'}
                                    </p>
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

                    {/* ── DETAILS ── */}
                    <div className="p-4 flex flex-col gap-4">

                        {/* Bio */}
                        {bio && (
                            <p className="text-xs text-gray-500 italic border-l-2 border-[#D4AF37] pl-3 leading-relaxed">
                                "{bio}"
                            </p>
                        )}

                        {/* Info grid — always visible */}
                        <div>
                            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Profile Details</h3>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: 'Education', value: educationDetails || education },
                                    { label: 'Profession', value: professionType },
                                    { label: 'Marital Status', value: maritalStatus || 'Single' },
                                    { label: 'Height', value: heightFeet ? `${heightFeet}'${heightInch || 0}"` : null },
                                    { label: 'Jamaat', value: jamaat },
                                    { label: 'Location', value: [city, state, country].filter(Boolean).join(', ') || hizratLocation },
                                ].filter(d => d.value).map(d => (
                                    <div key={d.label} className="bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">{d.label}</p>
                                        <p className="text-xs font-bold text-gray-700 truncate">{d.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Parents — hidden for female until accepted */}
                        {(fatherName || motherName) && (isAccepted || gender !== 'female') && (
                            <div className="bg-rose-50/50 rounded-xl px-3 py-2.5 border border-rose-100/50">
                                <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">Family</p>
                                <p className="text-xs font-semibold text-gray-600">
                                    Father: <span className="text-[#881337]">{fatherName || 'N/A'}</span>
                                    &nbsp;|&nbsp;
                                    Mother: <span className="text-[#881337]">{motherName || 'N/A'}</span>
                                </p>
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
                            <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                                <p className="text-[8px] font-bold text-amber-500 uppercase tracking-wider mb-0.5">💛 Partner Expectations</p>
                                <p className="text-xs text-amber-800 font-medium leading-relaxed">{partnerQualities}</p>
                            </div>
                        )}

                        {/* Contact — only after accepted */}
                        {isAccepted && (
                            <div className="bg-emerald-50 rounded-xl px-3 py-3 border border-emerald-200">
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
                                                : '💌 Send Interest Request'}
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
                        {viewerItsNumber && (
                            <div className="absolute inset-0 pointer-events-none flex flex-wrap overflow-hidden opacity-[0.06] items-center justify-center rounded-lg">
                                {Array.from({ length: 60 }).map((_, i) => (
                                    <span key={i} className="text-white font-extrabold text-sm whitespace-nowrap px-4 py-8 -rotate-45 select-none">{viewerItsNumber}</span>
                                ))}
                            </div>
                        )}
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
