"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Loader2, ShieldCheck, ExternalLink, Lock, Sparkles } from 'lucide-react';
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
                let meData: any = null;
                const meDoc = await getDoc(doc(db, 'users', user.uid));
                if (meDoc.exists()) {
                    meData = meDoc.data();
                    setIsMyProfileVerified(meData.status === 'verified' || meData.status === 'approved' || meData.isItsVerified === true);
                    setViewerItsNumber(meData.itsNumber || '');
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

                    // 👁️ Record Profile View (if not me)
                    if (user.uid !== id && !id.startsWith('dummy') && meData) {
                        const viewRef = collection(db, 'profile_views');
                        const viewKey = `${user.uid}_${id}`;
                        await addDoc(viewRef, {
                            viewerId: user.uid,
                            viewerName: meData.name || 'Anonymous',
                            viewerLibasUrl: meData.libasImageUrl || null,
                            profileId: id,
                            timestamp: serverTimestamp(),
                            viewKey: viewKey
                        });
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
        motherName, city, state, country, mobile, mobileCode, email, dob,
        siblings, noOfChildren, citizenOf, ancestralWatan, address,
        hifzStatus, completedUpto, serviceType, employmentDetails } = profile;

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
                                    <div className="bg-[#D4AF37]/20 backdrop-blur-sm border border-white/20 px-2.5 py-1 rounded-lg inline-block mt-2">
                                        <p className="text-white text-[11px] font-black uppercase tracking-widest leading-none">
                                            {jamaat || city || 'Bohra Community'} • {hizratLocation || 'Global'}
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
