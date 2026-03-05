"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Info, CheckCircle, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface DiscoveryCardProps {
    id: string; // The target user's ID
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    hizratLocation?: string;
    itsImageUrl?: string;
    libasImageUrl?: string;
    matchScore?: number;
    isMyProfileVerified?: boolean;
    gender?: string;
    isDummy?: boolean;
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
    // Enhanced fields
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
}

export default function DiscoveryCard({
    id, name, dob, jamaat, education, hizratLocation, libasImageUrl, gender, matchScore = 85,
    isMyProfileVerified = false, isDummy = false, heightFeet, heightInch, hobbies,
    partnerQualities, isBlurSecurityEnabled = true, isItsVerified = false, bio,
    isOnline = false, viewerItsNumber = '', extraImageUrl,
    // Destructure new fields
    ejamaatId, itsNumber, maritalStatus, mobile, mobileCode, email,
    fatherName, motherName, professionType, educationDetails,
    city, state, country
}: DiscoveryCardProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [requestSent, setRequestSent] = useState(false);
    const [requestStatus, setRequestStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [rejectCount, setRejectCount] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
    const [icebreakerText, setIcebreakerText] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);

    // Photo Gallery State
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);
    const [showLightbox, setShowLightbox] = useState(false);

    const photos = [libasImageUrl, extraImageUrl].filter(Boolean) as string[];
    const currentPhoto = photos[activePhotoIdx] || libasImageUrl;

    // Calculate approximate age
    const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / 31557600000) : 25;

    // Check if request already sent
    useEffect(() => {
        const checkExistingRequest = async () => {
            if (!user) return;
            const qOut = query(
                collection(db, "rishta_requests"),
                where("from", "==", user.uid),
                where("to", "==", id)
            );
            const qIn = query(
                collection(db, "rishta_requests"),
                where("from", "==", id),
                where("to", "==", user.uid)
            );

            const [snapOut, snapIn] = await Promise.all([getDocs(qOut), getDocs(qIn)]);

            let activeReq = false;
            let rejects = 0;

            const checkDoc = (doc: any) => {
                const s = doc.data().status;
                if (s === "rejected" || s === "ended") {
                    rejects++;
                } else {
                    activeReq = true;
                    setRequestStatus(s);
                }
            };

            snapOut.forEach(checkDoc);
            snapIn.forEach(checkDoc);

            setRequestSent(activeReq);
            setRejectCount(rejects);
        };
        checkExistingRequest();
    }, [user, id]);

    const handleSendRequest = async () => {
        if (!user) {
            toast.error("You must be logged in to send a request");
            return;
        }

        if (!isMyProfileVerified) {
            toast.error("Your profile must be approved by an Admin before sending interest requests.");
            return;
        }

        if (isDummy) {
            setLoading(true);
            setTimeout(() => {
                setRequestSent(true);
                toast.success("Demo Interest Request sent successfully!");
                setLoading(false);
            }, 800);
            return;
        }

        try {
            setLoading(true);

            // Spam Protection: Max 20 requests per 24 hours
            const spamCheckQ = query(
                collection(db, "rishta_requests"),
                where("from", "==", user.uid)
            );
            const spamSnap = await getDocs(spamCheckQ);
            let recentCount = 0;
            const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);

            spamSnap.forEach(d => {
                const reqData = d.data();
                if (reqData.timestamp) {
                    const reqDate = reqData.timestamp?.toDate ? reqData.timestamp.toDate() : new Date(reqData.timestamp);
                    if (reqDate.getTime() > oneDayAgo) {
                        recentCount++;
                    }
                }
            });

            if (recentCount >= 20) {
                toast.error("Spam Limit Protective Measure: You can only send up to 20 Interest Requests every 24 hours.", { duration: 6000, icon: '🛡️' });
                setLoading(false);
                return;
            }

            await addDoc(collection(db, "rishta_requests"), {
                from: user.uid,
                to: id,
                status: "pending_response",
                icebreaker: icebreakerText.trim(),
                timestamp: serverTimestamp()
            });

            const adminEmail = "abdulqadirkhanji52@gmail.com";
            const targetRecipients = [];
            if (email && email.includes('@')) targetRecipients.push(email);
            if (user.email && user.email.includes('@')) targetRecipients.push(user.email);

            try {
                await fetch("/api/notify", {
                    method: "POST",
                    body: JSON.stringify({
                        to: targetRecipients,
                        cc: [adminEmail],
                        subject: "Interest Request - DBohraRishta",
                        html: `
                            <div style="font-family: serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                <h2 style="color: #881337;">Interest Request Alert</h2>
                                <p>As-salaamu alaykum,</p>
                                <p>A new Interest Request has been recorded on <strong>DBohraRishta</strong>.</p>
                                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                    <p><strong>From:</strong> ${user.displayName || user.email || 'A Candidate'}</p>
                                    <p><strong>To:</strong> ${name}</p>
                                    <p><strong>Message:</strong></p>
                                    <p style="color: #555; font-style: italic;">"${icebreakerText.trim() || 'No message provided.'}"</p>
                                </div>
                                <p>Candidates can login to their dashboard to review and manage this request.</p>
                                <div style="margin-top: 25px;">
                                    <a href="https://53dbohrarishta.in" style="background: #881337; color: white; padding: 12px 25px; text-decoration: none; border-radius: 8px; font-weight: bold;">Login to Dashboard</a>
                                </div>
                                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                                <p style="font-size: 10px; color: #999;">DBohraRishta Notification System</p>
                            </div>
                        `
                    })
                });
            } catch (e) { console.error("Notification failed", e); }
            setRequestSent(true);
            setShowIcebreakerModal(false);
            toast.success("Interest Request sent successfully!");
        } catch (error: any) {
            toast.error("Failed to send request: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBookmark = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsBookmarked(!isBookmarked);
        toast.success(isBookmarked ? "Removed from saved profiles" : "Profile saved for later!");
    };

    return (
        <>
            <div
                className={`bg-[#F9FAFB] rounded-2xl shadow-xl border overflow-hidden max-w-sm w-full transition-all duration-300 flex flex-col cursor-pointer ${requestStatus === 'accepted' ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/30 shadow-[0_0_20px_rgba(212,175,55,0.15)]' : 'border-gray-100'} ${isExpanded ? 'max-w-md' : 'max-w-sm'}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* Photo Display (with Gallery Navigation if accepted) */}
                <div className="relative h-80 bg-gray-200 flex items-center justify-center overflow-hidden group/photo">
                    {currentPhoto ? (
                        <>
                            <img
                                src={currentPhoto}
                                alt="Profile"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // Only open lightbox if blur is off OR request is accepted
                                    if (!isBlurSecurityEnabled || requestStatus === 'accepted') {
                                        setShowLightbox(true);
                                    }
                                }}
                                className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ${(!isBlurSecurityEnabled || requestStatus === 'accepted') ? 'cursor-zoom-in opacity-100 scale-100' : 'blur-2xl scale-110 opacity-60 cursor-not-allowed'}`}
                            />

                            {/* Gallery Navigation Dots (only if accepted or public and has mult photos) */}
                            {photos.length > 1 && (!isBlurSecurityEnabled || requestStatus === 'accepted') && (
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-40">
                                    {photos.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={(e) => { e.stopPropagation(); setActivePhotoIdx(idx); }}
                                            className={`w-2 h-2 rounded-full transition-all ${activePhotoIdx === idx ? 'bg-[#D4AF37] w-4' : 'bg-white/60 hover:bg-white'}`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Watermark */}
                            {(!isBlurSecurityEnabled || requestStatus === 'accepted') && viewerItsNumber && (
                                <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap overflow-hidden opacity-[0.08] mix-blend-overlay items-center justify-center">
                                    {Array.from({ length: 40 }).map((_, i) => (
                                        <span key={i} className="text-black font-extrabold text-sm whitespace-nowrap px-4 py-8 -rotate-45 select-none">{viewerItsNumber}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={`absolute inset-0 w-full h-full flex items-center justify-center bg-gray-300 transition-all duration-300 ${(isBlurSecurityEnabled && requestStatus !== 'accepted') ? 'blur-2xl scale-110 opacity-40' : 'opacity-100'}`}>
                            <span className="text-4xl text-gray-400">📸 No Photo</span>
                        </div>
                    )}

                    {/* Small profile thumbnail – always clearly visible for identification, never blurred */}
                    {libasImageUrl ? (
                        <div className="absolute top-3 left-3 z-20 w-14 h-14 rounded-full border-2 border-white shadow-lg overflow-hidden ring-2 ring-[#D4AF37]/40">
                            <img
                                src={libasImageUrl}
                                alt={name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="absolute top-3 left-3 z-20 w-14 h-14 rounded-full border-2 border-white shadow-lg bg-gradient-to-br from-[#881337] to-[#D4AF37] flex items-center justify-center">
                            <span className="text-white font-black text-xl">{name?.charAt(0) || '?'}</span>
                        </div>
                    )}

                    {/* ✅ ITS Verified Badge — top-right, bold and prominent */}
                    {isItsVerified && (
                        <div className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in-75 duration-300">
                            <ShieldCheck className="w-3 h-3" />
                            ITS VERIFIED
                        </div>
                    )}

                    {(isBlurSecurityEnabled && requestStatus !== 'accepted') && (
                        <>
                            <div className="absolute inset-0 bg-gradient-to-br from-[#881337] to-[#D4AF37] blur-3xl opacity-20 hover:opacity-10 transition-opacity"></div>
                            <div className="z-10 flex flex-col items-center bg-white/60 p-5 rounded-2xl backdrop-blur-md border border-white/40 shadow-sm text-center">
                                <ShieldCheck className="w-10 h-10 text-[#881337] mb-2" />
                                <span className="text-md font-bold text-[#881337] leading-tight flex flex-col gap-1">
                                    <span>Dynamic Privacy</span>
                                    <span className="text-xs font-normal text-[#881337]/80 max-w-[120px]">Unblurs after accepted Interest</span>
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col flex-grow relative">
                    {isDummy && (
                        <div className="absolute top-0 right-0 bg-[#881337] text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-xl z-20 shadow-sm">
                            SAMPLE PROFILE
                        </div>
                    )}
                    {isOnline && (
                        <div className="absolute -top-3 left-6 bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full z-20 shadow-md border-2 border-white flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> Active Recently
                        </div>
                    )}
                    <div className="flex justify-between items-start mb-4 mt-2">
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-2xl font-bold text-[#881337] font-serif group-hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/profile?id=${id}`); }}>{name || 'Verified Member'}, {age}</h3>
                                {rejectCount > 0 && !requestSent && (
                                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100 uppercase mt-1">
                                        Not Accepted
                                    </span>
                                )}
                                {requestStatus === 'accepted' && (
                                    <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-100 uppercase mt-1">
                                        Accepted
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-600 font-sans text-sm mt-1">{jamaat || 'Community Member'} • {hizratLocation || 'Unknown'}</p>
                            <button onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className="text-xs text-[#D4AF37] font-bold hover:underline mt-1">
                                {isExpanded ? 'Collapse Details ↑' : 'View Full Details ↓'}
                            </button>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className="bg-[#881337] text-[#D4AF37] px-3 py-1 rounded-full text-xs font-bold flex items-center shadow-md">
                                <span>{matchScore}% Match</span>
                            </div>
                            <button
                                onClick={handleBookmark}
                                className={`p-1.5 rounded-full transition-colors ${isBookmarked ? 'bg-rose-100 text-[#881337]' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                title={isBookmarked ? "Saved" : "Save for later"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                            </button>
                        </div>
                    </div>

                    {bio && (
                        <div className="mb-4 text-sm text-gray-600 italic border-l-2 border-[#D4AF37] pl-3">
                            "{bio.length > 80 ? bio.substring(0, 80) + '...' : bio}"
                        </div>
                    )}

                    {/* 📜 Enhanced Biodata Display Section - ONLY SHOWN WHEN EXPANDED */}
                    {isExpanded && (
                        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-inner animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#881337]/60">Candidate Biodata</h4>
                                <div className="h-px bg-[#881337]/10 flex-1"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                                {/* Column 1 */}
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">ITS Number</p>
                                        <p className="text-xs font-black text-[#881337]">{ejamaatId || itsNumber || '••••••••'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Gender & Height</p>
                                        <p className="text-xs font-bold text-gray-700 capitalize">
                                            {gender || 'N/A'} • {heightFeet ? `${heightFeet}'${heightInch || '0'}"` : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Jamaat</p>
                                        <p className="text-xs font-bold text-gray-700 leading-tight">{jamaat || 'N/A'}</p>
                                    </div>
                                    {requestStatus === 'accepted' && (
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Mobile</p>
                                            <p className="text-xs font-bold text-emerald-600">
                                                {mobileCode || ''} {mobile}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Education</p>
                                        <p className="text-xs font-bold text-gray-700 leading-tight">{education || educationDetails || 'N/A'}</p>
                                    </div>
                                </div>

                                {/* Column 2 */}
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">DOB</p>
                                        <p className="text-xs font-bold text-gray-700">{dob || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Marital Status</p>
                                        <p className="text-xs font-bold text-gray-700 capitalize">{maritalStatus || 'Single'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Location</p>
                                        <p className="text-xs font-bold text-gray-700 leading-tight">
                                            {city ? `${city}${state ? `, ${state}` : ''}` : hizratLocation || 'N/A'}
                                        </p>
                                    </div>
                                    {requestStatus === 'accepted' && (
                                        <div>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase">Email</p>
                                            <p className="text-xs font-bold text-emerald-600">
                                                {email}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Profession</p>
                                        <p className="text-xs font-bold text-gray-700 leading-tight">{professionType || 'Professional'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Full Width Fields */}
                            <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-3">
                                <div>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase">Parents</p>
                                    <p className="text-xs font-bold text-gray-700">
                                        Father: <span className="text-[#881337]">{fatherName || 'N/A'}</span> | Mother: <span className="text-[#881337]">{motherName || 'N/A'}</span>
                                    </p>
                                </div>
                                {bio && (
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Bio</p>
                                        <p className="text-xs font-medium text-gray-600 italic leading-relaxed">"{bio}"</p>
                                    </div>
                                )}
                                {partnerQualities && (
                                    <div>
                                        <p className="text-[9px] font-bold text-gray-400 uppercase">Partner Qualities</p>
                                        <p className="text-xs font-bold text-[#D4AF37] leading-relaxed">{partnerQualities}</p>
                                    </div>
                                )}
                                <div className="mt-2 text-center">
                                    <button onClick={(e) => { e.stopPropagation(); router.push(`/profile?id=${id}`); }} className="text-[10px] font-bold text-[#881337] hover:underline flex items-center justify-center gap-1 mx-auto">
                                        Open Separate Profile Page <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {rejectCount >= 2 && !requestSent ? (
                        <div className="w-full z-20 py-3.5 bg-gray-50 text-gray-400 font-bold rounded-xl border border-gray-100 text-sm text-center shadow-sm">
                            Maximum request limit reached for this profile
                        </div>
                    ) : !isMyProfileVerified ? (
                        <div className="w-full z-20 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 text-center shadow-sm">
                            <p className="text-amber-800 font-bold text-xs leading-snug">
                                🔐 Please verify your original ITS to enable Send Request
                            </p>
                            <p className="text-amber-700 text-[10px] mt-0.5 font-medium">Awaiting ITS Verification by Admin</p>
                        </div>
                    ) : (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isMyProfileVerified && !requestSent && !isDummy) {
                                    setShowIcebreakerModal(true);
                                } else {
                                    handleSendRequest();
                                }
                            }}
                            disabled={requestSent || loading}
                            className={`w-full z-20 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2
                            ${requestStatus === 'accepted' ? 'bg-emerald-50 text-emerald-600 cursor-not-allowed border border-emerald-200 shadow-none' :
                                    requestSent ? 'bg-gray-100 text-[#881337] cursor-not-allowed border border-gray-200 shadow-none' :
                                        'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg'}`}
                        >
                            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                            {requestStatus === 'accepted' ? '✓ Interest Accepted' : requestSent ? 'Request Sent' : rejectCount === 1 ? 'Retry Send Request' : 'Send Request'}
                        </button>
                    )}
                </div>
            </div>



            {/* Icebreaker Pre-Send Modal */}
            {showIcebreakerModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl" onClick={(e) => { e.stopPropagation(); setShowIcebreakerModal(false); }}>
                    <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-xl font-bold font-serif text-[#881337] mb-2">Send Interest Request</h3>
                        <p className="text-sm text-gray-500 mb-4 leading-relaxed">Attaching a short personalized halal icebreaker (optional) can increase your chances of being accepted!</p>

                        <textarea
                            value={icebreakerText}
                            onChange={(e) => setIcebreakerText(e.target.value)}
                            placeholder="e.g. I see we both care about our Deeni & Dunyawi balance..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-[#D4AF37] text-sm mb-4 h-24"
                            maxLength={120}
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setShowIcebreakerModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm">Cancel</button>
                            <button onClick={handleSendRequest} className="flex-1 py-3 bg-[#D4AF37] text-white rounded-xl font-bold hover:bg-[#c29e2f] transition-colors text-sm flex items-center justify-center gap-2">
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />} Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 🖼️ Full-View Lightbox Modal */}
            {showLightbox && (!isBlurSecurityEnabled || requestStatus === 'accepted') && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
                    onClick={() => setShowLightbox(false)}
                >
                    {/* Escape Key handling (indirectly through focus or global listener if we wanted, but simple onClick handles most) */}

                    {/* Big Prominent Close Button on Top Right */}
                    <button
                        className="absolute top-6 right-6 z-[110] w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#881337] shadow-2xl hover:bg-rose-50 hover:scale-110 active:scale-90 transition-all border-4 border-[#881337]/20"
                        onClick={(e) => { e.stopPropagation(); setShowLightbox(false); }}
                        title="Close full view (Esc)"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                        <img
                            src={currentPhoto}
                            alt="Original Full View"
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                        />

                        {photos.length > 1 && (
                            <>
                                <button
                                    onClick={() => setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length)}
                                    className="absolute left-2 md:-left-16 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all shadow-xl"
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button
                                    onClick={() => setActivePhotoIdx((prev) => (prev + 1) % photos.length)}
                                    className="absolute right-2 md:-right-16 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-sm transition-all shadow-xl"
                                >
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </>
                        )}

                        <div className="absolute -bottom-10 left-0 right-0 text-center text-white/60 text-sm font-bold tracking-widest uppercase">
                            Original Photo • {activePhotoIdx + 1} of {photos.length}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
