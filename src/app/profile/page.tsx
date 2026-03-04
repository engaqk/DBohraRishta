"use client";
import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Loader2, ShieldCheck, CheckCircle, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';

// Dummy data for visual testing mock profiles
const DUMMIES = [
    { id: "dummy1", name: "Aliya", dob: "1998-05-15", jamaat: "Colpetty Jamaat, Colombo", education: "MBA in Finance", hizratLocation: "Colombo, LK", isItsVerified: true, isDummy: true, hobbies: "Traveling, Cooking", partnerQualities: "Looking for a well-educated partner with good Deeni understanding.", bio: "I am an ambitious professional balancing deen and dunya.", heightFeet: "5", heightInch: "4" },
    { id: "dummy2", name: "Fatima", dob: "2000-02-10", jamaat: "Saifee Park Jamaat, Dubai", education: "Software Engineer", hizratLocation: "Dubai, UAE", isItsVerified: true, isDummy: true, hobbies: "Reading, Painting", partnerQualities: "Respectful, caring, and financially stable.", bio: "Software engineer who loves reading and exploring new tech.", heightFeet: "5", heightInch: "6" },
    { id: "dummy3", name: "Zahra", dob: "1999-11-20", jamaat: "Husaini Jamaat, London", education: "Doctor of Medicine", hizratLocation: "London, UK", isItsVerified: true, isDummy: true, hobbies: "Photography, Swimming", partnerQualities: "Family-oriented and supportive.", bio: "Dedicated doctor with a passion for helping others.", heightFeet: "5", heightInch: "2" }
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

    // Zoom state
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!user) return;
            try {
                // Fetch current user
                const meDoc = await getDoc(doc(db, "users", user.uid));
                if (meDoc.exists()) {
                    setIsMyProfileVerified(meDoc.data().status === 'verified');
                    setViewerItsNumber(meDoc.data().itsNumber || '');
                }

                if (id) {
                    if (id.startsWith('dummy')) {
                        const dummyProfile = DUMMIES.find(d => d.id === id);
                        if (dummyProfile) {
                            setProfile(dummyProfile);
                        } else {
                            toast.error("Profile not found");
                            router.push("/");
                            return;
                        }
                    } else {
                        const profileDoc = await getDoc(doc(db, "users", id));
                        if (profileDoc.exists()) {
                            setProfile(profileDoc.data());
                        } else {
                            toast.error("Profile not found");
                            router.push("/");
                            return;
                        }
                    }

                    const qOut = query(collection(db, "rishta_requests"), where("from", "==", user.uid), where("to", "==", id));
                    const qIn = query(collection(db, "rishta_requests"), where("from", "==", id), where("to", "==", user.uid));

                    const [snapOut, snapIn] = await Promise.all([getDocs(qOut), getDocs(qIn)]);

                    let activeReq = false;
                    let rejects = 0;
                    let status = null;

                    const checkDoc = (docSnap: any) => {
                        const s = docSnap.data().status;
                        if (s === "rejected" || s === "ended") {
                            rejects++;
                        } else {
                            activeReq = true;
                            status = s;
                        }
                    };

                    snapOut.forEach(checkDoc);
                    snapIn.forEach(checkDoc);

                    setRequestSent(activeReq);
                    setRejectCount(rejects);
                    setRequestStatus(status);
                }
            } catch (error) {
                console.error("Error fetching profile", error);
                toast.error("Failed to load profile details");
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [user, id, router]);

    const handleSendRequest = async () => {
        if (!user || !id) return;
        if (!isMyProfileVerified) {
            toast.error("Your profile must be approved by an Admin before sending interest requests.");
            return;
        }

        if (id.startsWith('dummy')) {
            setActionLoading(true);
            setTimeout(() => {
                setRequestSent(true);
                toast.success("Demo Interest Request sent successfully!");
                setActionLoading(false);
            }, 800);
            return;
        }

        try {
            setActionLoading(true);
            const spamCheckQ = query(collection(db, "rishta_requests"), where("from", "==", user.uid));
            const spamSnap = await getDocs(spamCheckQ);
            let recentCount = 0;
            const oneDayAgo = new Date().getTime() - (24 * 60 * 60 * 1000);

            spamSnap.forEach(d => {
                const reqData = d.data();
                if (reqData.timestamp) {
                    const reqDate = reqData.timestamp?.toDate ? reqData.timestamp.toDate() : new Date(reqData.timestamp);
                    if (reqDate.getTime() > oneDayAgo) recentCount++;
                }
            });

            if (recentCount >= 20) {
                toast.error("Spam Limit Protective Measure: Max 20 requests per 24 hours.", { duration: 6000 });
                return;
            }

            await addDoc(collection(db, "rishta_requests"), {
                from: user.uid,
                to: id,
                status: "pending_response",
                icebreaker: "",
                timestamp: serverTimestamp()
            });
            setRequestSent(true);
            toast.success("Interest Request sent successfully!");
        } catch (error: any) {
            toast.error("Failed to send request: " + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-center items-center">
                <Loader2 className="w-10 h-10 text-[#881337] animate-spin" />
                <p className="mt-4 text-gray-500 font-bold">Loading Profile...</p>
            </div>
        );
    }

    if (!profile) {
        return <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center font-bold text-gray-400">Profile Not Found</div>;
    }

    const { name, dob, jamaat, education, hizratLocation, libasImageUrl, extraImageUrl, gender, hobbies, partnerQualities, bio, isItsVerified, heightFeet, heightInch } = profile;
    const isBlurSecurityEnabled = profile.isBlurSecurityEnabled !== false;

    const age = dob ? Math.floor((new Date().getTime() - new Date(dob).getTime()) / 31557600000) : 25;
    const canSeeUnblurred = (!isBlurSecurityEnabled || requestStatus === 'accepted');

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            {/* Header / Nav */}
            <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-[#881337] flex items-center gap-2 font-bold transition-colors">
                        <ArrowLeft className="w-5 h-5" /> Back to Dashboard
                    </button>
                    <div className="font-serif font-bold text-[#881337] text-xl">
                        Profile Details
                    </div>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-gray-100 mb-8 animate-in slide-in-from-bottom-4 duration-500">

                    {/* Hero Image Section */}
                    <div className="relative h-64 md:h-96 bg-gray-200 flex items-center justify-center overflow-hidden">
                        {libasImageUrl ? (
                            <>
                                <img
                                    src={libasImageUrl}
                                    alt="Profile"
                                    onClick={() => { if (canSeeUnblurred) setZoomedImage(libasImageUrl); }}
                                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${!canSeeUnblurred ? 'blur-3xl scale-125 opacity-70' : 'opacity-100 scale-100 cursor-zoom-in'}`}
                                />
                                {canSeeUnblurred && viewerItsNumber && (
                                    <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap overflow-hidden opacity-[0.08] mix-blend-overlay items-center justify-center">
                                        {Array.from({ length: 60 }).map((_, i) => (
                                            <span key={i} className="text-black font-extrabold text-sm whitespace-nowrap px-4 py-8 -rotate-45 select-none">{viewerItsNumber}</span>
                                        ))}
                                    </div>
                                )}
                                {canSeeUnblurred && (
                                    <div className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 backdrop-blur-md pointer-events-none">
                                        <ZoomIn className="w-5 h-5" />
                                    </div>
                                )}
                            </>
                        ) : (
                            <span className="text-7xl">📸</span>
                        )}

                        {!canSeeUnblurred && <ShieldCheck className="w-24 h-24 text-gray-300 relative z-10" />}
                        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-10"></div>

                        {/* Profile Summary Info overlaid */}
                        <div className="absolute bottom-6 left-6 md:left-10 z-20">
                            <h1 className="text-3xl md:text-4xl font-bold font-serif text-white flex items-center gap-3">
                                {name}, {age}
                                {isItsVerified && (
                                    <span className="bg-[#D4AF37] text-[#881337] px-2 py-1 rounded-md text-sm font-bold flex items-center gap-1 shadow-lg ml-2">
                                        <CheckCircle className="w-4 h-4" /> ITS Approved
                                    </span>
                                )}
                            </h1>
                            <div className="flex items-center gap-3 mt-2">
                                {rejectCount > 0 && !requestSent && (
                                    <span className="bg-red-500/80 text-white backdrop-blur-sm px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border border-red-500/50 uppercase">
                                        Not Accepted
                                    </span>
                                )}
                                {requestStatus === 'accepted' && (
                                    <span className="bg-emerald-500/80 text-white backdrop-blur-sm px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border border-emerald-500/50 uppercase">
                                        Interest accepted
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-10">
                        {/* Highlights */}
                        {bio && (
                            <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 mb-8 shadow-sm">
                                <p className="text-[#881337] font-medium leading-relaxed italic text-lg">"{bio}"</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Detailed Info Blocks */}
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-[#881337] font-bold font-serif text-xl border-b-2 border-gray-100 pb-2 mb-4">Core Information</h2>
                                    <div className="space-y-4">
                                        <div className="flex bg-gray-50 p-4 rounded-xl border border-gray-100 justify-between items-center">
                                            <span className="text-gray-500 font-bold text-sm">Jamaat</span>
                                            <span className="text-[#881337] font-semibold">{jamaat || 'Not specified'}</span>
                                        </div>
                                        <div className="flex bg-gray-50 p-4 rounded-xl border border-gray-100 justify-between items-center">
                                            <span className="text-gray-500 font-bold text-sm">Current Location</span>
                                            <span className="text-[#881337] font-semibold">{hizratLocation || 'Not specified'}</span>
                                        </div>
                                        <div className="flex bg-gray-50 p-4 rounded-xl border border-gray-100 justify-between items-center">
                                            <span className="text-gray-500 font-bold text-sm">Height</span>
                                            <span className="text-[#881337] font-semibold">{heightFeet || heightInch ? `${heightFeet || 0}' ${heightInch || 0}"` : 'Not specified'}</span>
                                        </div>
                                    </div>
                                </div>
                                {extraImageUrl && canSeeUnblurred && (
                                    <div>
                                        <h2 className="text-[#881337] font-bold font-serif text-xl border-b-2 border-gray-100 pb-2 mb-4">Additional Photos</h2>
                                        <div className="w-full aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 relative group">
                                            <img
                                                src={extraImageUrl}
                                                alt="Extra Profile"
                                                onClick={() => setZoomedImage(extraImageUrl)}
                                                className="w-full h-full object-cover cursor-zoom-in transition-transform duration-300 group-hover:scale-105"
                                            />
                                            <div className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 backdrop-blur-md pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ZoomIn className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-[#881337] font-bold font-serif text-xl border-b-2 border-gray-100 pb-2 mb-4">Education & Interests</h2>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
                                        <p className="text-gray-500 text-xs font-bold mb-1">Education / Profession</p>
                                        <p className="text-[#881337] font-semibold">{education || 'Not specified'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
                                        <p className="text-gray-500 text-xs font-bold mb-1">Hobbies & Interests</p>
                                        <p className="text-[#881337] font-semibold text-sm leading-relaxed">{hobbies || 'Not specified'}</p>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <p className="text-gray-500 text-xs font-bold mb-1">Partner Expectations</p>
                                        <p className="text-[#881337] font-semibold text-sm leading-relaxed">{partnerQualities || 'Not specified'}</p>
                                    </div>
                                </div>

                                {!canSeeUnblurred && (
                                    <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex gap-4 items-start shadow-sm mt-4">
                                        <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="font-bold text-amber-800 mb-1 text-sm">Photos Hidden</h4>
                                            <p className="text-xs text-amber-700/80 leading-relaxed">Due to privacy settings, photos remain blurred until an Interest Request is manually accepted by this user.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Box */}
                        <div className="mt-10 pt-8 border-t border-gray-100">
                            {rejectCount >= 2 && !requestSent ? (
                                <div className="w-full py-5 text-center bg-gray-100 text-gray-500 font-bold rounded-xl border border-gray-200 shadow-inner">
                                    Maximum request limit reached for this profile
                                </div>
                            ) : (
                                <button
                                    onClick={handleSendRequest}
                                    disabled={requestSent || actionLoading || !isMyProfileVerified}
                                    className={`w-full py-5 rounded-xl font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-xl
                                    ${!isMyProfileVerified ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200' :
                                            requestStatus === 'accepted' ? 'bg-emerald-50 text-emerald-600 cursor-not-allowed border border-emerald-200 shadow-none' :
                                                requestSent ? 'bg-gray-100 text-[#881337] cursor-not-allowed border border-gray-200 shadow-none' :
                                                    'bg-[#D4AF37] text-white hover:bg-[#c29e2f] hover:shadow-lg hover:-translate-y-1'}`}
                                >
                                    {actionLoading && <Loader2 className="w-6 h-6 animate-spin" />}
                                    {!isMyProfileVerified ? 'Awaiting Verification' : requestStatus === 'accepted' ? 'Interest Accepted' : requestSent ? 'Request Already Sent' : rejectCount === 1 ? 'Retry Send Interest Request' : 'Send Interest Request'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Zoom Overlay */}
            {zoomedImage && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setZoomedImage(null)}
                >
                    <img src={zoomedImage} alt="Zoomed out" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-200" />
                    {viewerItsNumber && (
                        <div className="absolute inset-0 pointer-events-none z-30 flex flex-wrap overflow-hidden opacity-[0.15] mix-blend-overlay items-center justify-center">
                            {Array.from({ length: 150 }).map((_, i) => (
                                <span key={i} className="text-white font-extrabold text-lg whitespace-nowrap px-8 py-16 -rotate-45 select-none">{viewerItsNumber}</span>
                            ))}
                        </div>
                    )}
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white bg-black/50 hover:bg-black p-3 rounded-full transition-all"
                        onClick={(e) => { e.stopPropagation(); setZoomedImage(null); }}
                    >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
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
