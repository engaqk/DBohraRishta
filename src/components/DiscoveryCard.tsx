"use client";
import React, { useState, useEffect } from 'react';
import { Info, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';
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
}

export default function DiscoveryCard({ id, name, dob, jamaat, education, hizratLocation, libasImageUrl, gender, matchScore = 85, isMyProfileVerified = false, isDummy = false, heightFeet, heightInch, hobbies, partnerQualities, isBlurSecurityEnabled = true, isItsVerified = false, bio, isOnline = false, viewerItsNumber = '' }: DiscoveryCardProps) {
    const { user } = useAuth();
    const [requestSent, setRequestSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [rejectCount, setRejectCount] = useState(0);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [showIcebreakerModal, setShowIcebreakerModal] = useState(false);
    const [icebreakerText, setIcebreakerText] = useState("");

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
                className="bg-[#F9FAFB] rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-w-sm w-full transition-transform hover:scale-[1.02] flex flex-col cursor-pointer"
                onClick={() => setShowDetails(true)}
            >
                {/* Blurred Photo Placeholder */}
                <div className="relative h-72 bg-gray-200 flex items-center justify-center overflow-hidden">
                    {libasImageUrl ? (
                        <>
                            <img src={libasImageUrl} alt="Profile" className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${isBlurSecurityEnabled ? 'blur-2xl scale-110 opacity-60' : 'opacity-100 scale-100'}`} />
                            {!isBlurSecurityEnabled && viewerItsNumber && (
                                <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap overflow-hidden opacity-[0.08] mix-blend-overlay items-center justify-center">
                                    {Array.from({ length: 40 }).map((_, i) => (
                                        <span key={i} className="text-black font-extrabold text-sm whitespace-nowrap px-4 py-8 -rotate-45 select-none">{viewerItsNumber}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={`absolute inset-0 w-full h-full flex items-center justify-center bg-gray-300 transition-all duration-300 ${isBlurSecurityEnabled ? 'blur-2xl scale-110 opacity-40' : 'opacity-100'}`}>
                            <span className="text-4xl">📸</span>
                        </div>
                    )}

                    {/* For Female Profiles, show a small, somewhat clear thumbnail snippet if requested by user for 'testing visual differences', or similar feature */}
                    {gender === 'female' && libasImageUrl && isBlurSecurityEnabled && (
                        <div className="absolute bottom-4 right-4 w-16 h-16 rounded-full border-2 border-white/50 shadow-lg overflow-hidden opacity-90 backdrop-blur-sm pointer-events-none">
                            <img src={libasImageUrl} alt="Preview" className="w-full h-full object-cover blur-[2px]" />
                        </div>
                    )}

                    {isBlurSecurityEnabled && (
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
                                <h3 className="text-2xl font-bold text-[#881337] font-serif group-hover:underline cursor-pointer" onClick={() => setShowDetails(true)}>{name || 'Verified Member'}, {age}</h3>
                                {rejectCount > 0 && !requestSent && (
                                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold border border-red-100 uppercase mt-1">
                                        Not Accepted
                                    </span>
                                )}
                            </div>
                            <p className="text-gray-600 font-sans text-sm mt-1">{jamaat || 'Community Member'} • {hizratLocation || 'Unknown'}</p>
                            <button onClick={() => setShowDetails(true)} className="text-xs text-[#D4AF37] font-bold hover:underline mt-1">View Full Profile →</button>
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

                    <div className="space-y-3 mb-6 flex-grow">
                        <div className="flex items-center text-sm">
                            {isItsVerified ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-[#D4AF37] mr-3 shrink-0" />
                                    <span className="text-gray-700 font-medium">ITS Verified Profile</span>
                                </>
                            ) : (
                                <>
                                    <span className="w-5 h-5 border-2 border-gray-300 rounded-full mr-3 shrink-0" />
                                    <span className="text-gray-400 italic">ITS Verification Pending</span>
                                </>
                            )}
                        </div>
                        <div className="flex items-center text-sm">
                            <Info className="w-5 h-5 text-[#D4AF37] mr-3 shrink-0" />
                            <span className="text-gray-700 truncate">{education || 'Graduated'}</span>
                        </div>
                    </div>

                    {rejectCount >= 2 && !requestSent ? (
                        <div className="w-full z-20 py-3.5 bg-gray-50 text-gray-400 font-bold rounded-xl border border-gray-100 text-sm text-center shadow-sm">
                            Maximum request limit reached for this profile
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
                            disabled={requestSent || loading || !isMyProfileVerified}
                            className={`w-full z-20 py-3.5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 
                            ${!isMyProfileVerified ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200' :
                                    requestSent ? 'bg-gray-100 text-[#881337] cursor-not-allowed border border-gray-200 shadow-none' :
                                        'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg'}`}
                        >
                            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                            {!isMyProfileVerified ? 'Awaiting Verification' : requestSent ? 'Request Sent' : rejectCount === 1 ? 'Retry Send Request' : 'Send Request'}
                        </button>
                    )}
                </div>
            </div>

            {/* Profile Detail Modal */}
            {
                showDetails && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 sm:mt-0 mt-10" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowDetails(false)}>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>

                            <div className="relative h-48 bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                                    {libasImageUrl ? (
                                        <>
                                            <img src={libasImageUrl} alt="Profile" className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${isBlurSecurityEnabled ? 'blur-3xl scale-125 opacity-70' : 'opacity-100 scale-100'}`} />
                                            {!isBlurSecurityEnabled && viewerItsNumber && (
                                                <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap overflow-hidden opacity-[0.08] mix-blend-overlay items-center justify-center">
                                                    {Array.from({ length: 60 }).map((_, i) => (
                                                        <span key={i} className="text-black font-extrabold text-sm whitespace-nowrap px-4 py-8 -rotate-45 select-none">{viewerItsNumber}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <span className="text-7xl">📸</span>
                                    )}
                                    {isBlurSecurityEnabled && <ShieldCheck className="w-24 h-24 text-gray-300 relative z-10" />}
                                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent"></div>
                                </div>
                                <button onClick={() => setShowDetails(false)} className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 hover:bg-black/60 transition-colors z-20">
                                    <span className="sr-only">Close</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                </button>

                                <div className="absolute bottom-6 left-6 z-10">
                                    <div className="flex flex-col">
                                        <h2 className="text-3xl font-bold font-serif text-white flex items-center gap-3">
                                            {name}, {age}
                                            {isItsVerified && (
                                                <div className="bg-[#D4AF37] text-[#881337] px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1 shadow-lg">
                                                    <CheckCircle className="w-3 h-3" /> Verified Member
                                                </div>
                                            )}
                                        </h2>
                                        <div className="flex items-center gap-3">
                                            <p className={`font-medium flex items-center gap-2 mt-1 ${isItsVerified ? 'text-[#D4AF37]' : 'text-gray-400 italic font-normal'}`}>
                                                {isItsVerified ? <><CheckCircle className="w-4 h-4" /> ITS Verified</> : 'Pending ITS Verification'}
                                            </p>
                                            {rejectCount > 0 && !requestSent && (
                                                <span className="bg-red-500/80 text-white backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold border border-red-500/50 uppercase">
                                                    Not Accepted
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">

                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Core Details</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {bio && (
                                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 col-span-2">
                                                <p className="text-[#881337]/70 text-xs font-bold mb-1 uppercase tracking-widest">Highlights / About Me</p>
                                                <p className="text-[#881337] font-medium leading-relaxed italic">"{bio}"</p>
                                            </div>
                                        )}
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Jamaat</p>
                                            <p className="text-[#881337] font-semibold">{jamaat || 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Location</p>
                                            <p className="text-[#881337] font-semibold">{hizratLocation || 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Education / Profession</p>
                                            <p className="text-[#881337] font-semibold">{education || 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2 md:col-span-1">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Height</p>
                                            <p className="text-[#881337] font-semibold">{heightFeet || heightInch ? `${heightFeet || 0}' ${heightInch || 0}"` : 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Hobbies & Interests</p>
                                            <p className="text-[#881337] font-semibold text-sm leading-relaxed">{hobbies || 'Not specified'}</p>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 col-span-2">
                                            <p className="text-gray-500 text-xs font-bold mb-1">Partner Expectations</p>
                                            <p className="text-[#881337] font-semibold text-sm leading-relaxed">{partnerQualities || 'Not specified'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 flex gap-4 items-start">
                                    <ShieldCheck className="w-8 h-8 text-[#881337] shrink-0 mt-1" />
                                    <div>
                                        <h4 className="font-bold text-[#881337] mb-1">Private & Secure</h4>
                                        <p className="text-sm text-[#881337]/80 leading-relaxed">Photos and detailed contact information remain fully blurred and hidden until an Interest Request is mutually accepted.</p>
                                    </div>
                                </div>

                            </div>

                            <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
                                {rejectCount >= 2 && !requestSent ? (
                                    <div className="w-full py-4 text-center bg-gray-100 text-gray-500 font-bold rounded-xl border border-gray-200 shadow-inner">
                                        Maximum request limit reached for this profile
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleSendRequest}
                                        disabled={requestSent || loading || !isMyProfileVerified}
                                        className={`w-full py-4 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-lg
                                        ${!isMyProfileVerified ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200' :
                                                requestSent ? 'bg-gray-100 text-[#881337] cursor-not-allowed border border-gray-200 shadow-none' :
                                                    'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg'}`}
                                    >
                                        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                        {!isMyProfileVerified ? 'Awaiting Admin Verification' : requestSent ? 'Request Already Sent' : rejectCount === 1 ? 'Retry Send Interest Request' : 'Send Interest Request'}
                                    </button>
                                )}
                            </div>

                        </div>
                    </div>
                )
            }

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
        </>
    );
}
