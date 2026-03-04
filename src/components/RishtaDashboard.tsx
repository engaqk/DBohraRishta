"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DiscoveryCard from './DiscoveryCard';
import PrivacyToggle from './PrivacyToggle';
import ChatWindow from './ChatWindow';
import { Sparkles, MessageCircle, ShieldCheck, Heart, LogOut, X, Check, Clock, Loader2, CreditCard, ShieldAlert, CheckCircle, Info, Send, PauseCircle } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
interface UserProfile {
    id: string;
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    hizratLocation?: string;
    isItsVerified?: boolean;
    gender?: string;
    libasImageUrl?: string;
    isDummy?: boolean;
    heightFeet?: string;
    heightInch?: string;
    hobbies?: string;
    partnerQualities?: string;
    bio?: string;
}

interface RishtaRequest {
    id: string;
    from: string;
    to: string;
    status: string;
    isIncoming: boolean;
    // Resolved Data
    otherUserName: string;
    otherUserAge: number;
    otherUserLocation: string;
    otherUserEducation: string;
    otherUserMobile: string;
    otherUserEmail: string;
    otherUserLibasUrl: string | null;
    otherUserBlurSecurityEnabled: boolean;
}

export default function RishtaDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    // UI State
    const [activeTab, setActiveTab] = useState<'mybiodata' | 'discovery' | 'requests' | 'messages' | 'notifications'>('discovery');
    const [dataLoading, setDataLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Live Data State
    const [discoveryProfiles, setDiscoveryProfiles] = useState<UserProfile[]>([]);
    const [allRequests, setAllRequests] = useState<RishtaRequest[]>([]);
    const [myProfile, setMyProfile] = useState<any>(null);

    // Feature Modules State
    const [activeChat, setActiveChat] = useState<{ id: string, name: string, imageUrl?: string } | null>(null);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [showMyProfileModal, setShowMyProfileModal] = useState(false);

    // Admin Messaging State
    const [adminMsgThread, setAdminMsgThread] = useState<{ id: string; text: string; from: 'admin' | 'user'; createdAt: any }[]>([]);
    const [userMsgInput, setUserMsgInput] = useState('');
    const [showAdminMessages, setShowAdminMessages] = useState(false);
    const [itsReuploadUrl, setItsReuploadUrl] = useState<string | null>(null);
    const [showVerifiedCelebration, setShowVerifiedCelebration] = useState(false);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    // Accept Request Contact Modal
    const [acceptingRequest, setAcceptingRequest] = useState<RishtaRequest | null>(null);
    const [acceptMobile, setAcceptMobile] = useState('');
    const [acceptEmail, setAcceptEmail] = useState('');
    const [acceptError, setAcceptError] = useState('');

    // Subscribe to admin message thread for current user
    useEffect(() => {
        if (!user) return;
        const msgRef = collection(db, 'admin_messages', user.uid, 'thread');
        const q = query(msgRef, orderBy('createdAt', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            setAdminMsgThread(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
        });
        return () => unsub();
    }, [user]);

    const handleSendMessageToAdmin = async () => {
        if (!userMsgInput.trim() || !user) return;
        try {
            await addDoc(collection(db, 'admin_messages', user.uid, 'thread'), {
                text: userMsgInput.trim(),
                from: 'user',
                createdAt: serverTimestamp(),
            });
            setUserMsgInput('');
        } catch (e: any) {
            toast.error('Could not send message.');
        }
    };

    const handleITSReupload = async (file: File) => {
        if (!user || !file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                setItsReuploadUrl(dataUrl);
                await updateDoc(doc(db, 'users', user.uid), {
                    itsImageUrl: dataUrl,
                    status: 'pending_verification',
                    adminMessage: '',
                    isItsVerified: false,
                });
                toast.success('ITS photo updated! Submitted for re-verification.');
            };
        } catch (e: any) {
            toast.error('Failed to upload: ' + e.message);
        }
    };

    // Tour State managed by driver.js
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenTour');
        if (!hasSeenTour) {
            setTimeout(() => {
                const driverObj = driver({
                    showProgress: true,
                    steps: [
                        {
                            popover: { title: 'Welcome to DBohraRishta!', description: "Let's take a quick tour to help you find your perfect halal match." }
                        },
                        {
                            element: '#profile-completeness-section',
                            popover: { title: 'Your Biodata', description: 'Complete your registration here to become visible to others.', side: "right", align: 'start' }
                        },
                        {
                            element: '#discovery-nav-tab',
                            popover: { title: 'Discovery Tab', description: 'Find and browse highly compatible matches here.', side: "bottom", align: 'start' }
                        },
                        {
                            element: '#requests-nav-tab',
                            popover: { title: 'Interest Requests', description: 'Manage incoming and outgoing requests.', side: "bottom", align: 'start' }
                        },
                        {
                            element: '#messages-nav-tab',
                            popover: { title: 'Accepted Connections', description: 'Once mutually accepted, photos unblur and you can chat safely here!', side: "bottom", align: 'start' }
                        }
                    ],
                    onDestroyStarted: () => {
                        localStorage.setItem('hasSeenTour', 'true');
                        driverObj.destroy();
                    }
                });
                driverObj.drive();
            }, 1000);
        }
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        let unsubOutgoing: (() => void) | null = null;
        let unsubIncoming: (() => void) | null = null;
        let currentOutSnap: any = null;
        let currentInSnap: any = null;

        const resolveAndSetRequests = async (outSnap: any, inSnap: any) => {
            let requestsRaw: any[] = [];
            if (outSnap) { outSnap.forEach((d: any) => requestsRaw.push({ id: d.id, isIncoming: false, ...d.data() })); }
            if (inSnap) { inSnap.forEach((d: any) => requestsRaw.push({ id: d.id, isIncoming: true, ...d.data() })); }

            const resolvedRequests: RishtaRequest[] = [];
            for (const req of requestsRaw) {
                const targetId = req.isIncoming ? req.from : req.to;
                if (targetId === "dummy1" || targetId === "dummy2" || targetId === "dummy3") {
                    resolvedRequests.push({
                        ...req,
                        otherUserName: targetId === "dummy1" ? "Aliya" : targetId === "dummy2" ? "Fatima" : "Zahra",
                        otherUserAge: 25,
                        otherUserLocation: "Global",
                        otherUserEducation: "General",
                        otherUserMobile: "+91 0000000000",
                        otherUserEmail: "dummy@example.com",
                        otherUserLibasUrl: null,
                        otherUserBlurSecurityEnabled: true,
                    });
                    continue;
                }

                // Ghosting Prevention: Auto-expire pending requests older than 14 days
                if (req.status === "pending_response" && req.timestamp) {
                    const reqDate = req.timestamp?.toDate ? req.timestamp.toDate() : new Date(req.timestamp);
                    const diffDays = Math.floor((new Date().getTime() - reqDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays >= 14) {
                        try {
                            await updateDoc(doc(db, "rishta_requests", req.id), { status: "expired" });
                            req.status = "expired";
                        } catch (e) { }
                    }
                }

                try {
                    const uRef = await getDoc(doc(db, "users", targetId));
                    if (uRef.exists()) {
                        const uData = uRef.data();
                        resolvedRequests.push({
                            ...req,
                            otherUserName: uData.name || "Unknown Member",
                            otherUserAge: uData.dob ? Math.floor((new Date().getTime() - new Date(uData.dob).getTime()) / 31557600000) : 25,
                            otherUserLocation: uData.hizratLocation || "Global Network",
                            otherUserEducation: uData.education || uData.profession || "Graduated",
                            otherUserMobile: uData.mobile ? `${uData.mobileCode || ''} ${uData.mobile}` : "Not Shared",
                            otherUserEmail: uData.email || "Not Shared",
                            otherUserLibasUrl: uData.libasImageUrl || null,
                            otherUserBlurSecurityEnabled: uData.isBlurSecurityEnabled !== false,
                        });
                    }
                } catch (e) { }
            }

            setAllRequests(resolvedRequests.sort((a, b) => b.status.localeCompare(a.status)));
            setDataLoading(false);
        };

        const setupRequestsListeners = () => {
            const outgoingQ = query(collection(db, "rishta_requests"), where("from", "==", user.uid));
            const incomingQ = query(collection(db, "rishta_requests"), where("to", "==", user.uid));

            unsubOutgoing = onSnapshot(outgoingQ, (snap) => {
                currentOutSnap = snap;
                if (currentInSnap) resolveAndSetRequests(currentOutSnap, currentInSnap);
            });
            unsubIncoming = onSnapshot(incomingQ, (snap) => {
                currentInSnap = snap;
                if (currentOutSnap) resolveAndSetRequests(currentOutSnap, currentInSnap);
            });
        };

        const unsubMe = onSnapshot(doc(db, "users", user.uid), async (meRef) => {
            try {
                if (!meRef.exists()) {
                    router.push('/onboarding');
                    return;
                }
                const profileData = meRef.data();
                setMyProfile(profileData);

                // 🎉 Show verified celebration if newly verified
                const isVerified = profileData.isItsVerified === true ||
                    profileData.status === 'verified' || profileData.status === 'approved';
                const celebKey = `verified_celebrated_${user.uid}`;
                if (isVerified && !localStorage.getItem(celebKey)) {
                    setShowVerifiedCelebration(true);
                    localStorage.setItem(celebKey, 'true');
                }

                if (profileData.status === 'rejected' || profileData.status === 'hold') {
                    setDataLoading(false);
                    return;
                }

                let profiles: UserProfile[] = [];
                const oppositeGender = profileData.gender === 'male' ? 'female' : 'male';

                // Real-time on discovery not usually done as it fetches too much, but we getDocs again if our own profile changes
                const q = query(collection(db, "users"), where("isItsVerified", "==", true));
                const snap = await getDocs(q);
                snap.forEach(d => {
                    const data = d.data();
                    if (d.id !== user.uid && data.gender === oppositeGender) {
                        profiles.push({ id: d.id, ...data } as UserProfile);
                    }
                });

                if (profiles.length === 0) {
                    profiles = [
                        { id: "dummy1", name: "Aliya", dob: "1998-05-15", jamaat: "Colpetty Jamaat, Colombo", education: "MBA in Finance", hizratLocation: "Colombo, LK", isItsVerified: true, isDummy: true, hobbies: "Traveling, Cooking", partnerQualities: "Looking for a well-educated partner with good Deeni understanding.", bio: "I am an ambitious professional balancing deen and dunya.", heightFeet: "5", heightInch: "4" },
                        { id: "dummy2", name: "Fatima", dob: "2000-02-10", jamaat: "Saifee Park Jamaat, Dubai", education: "Software Engineer", hizratLocation: "Dubai, UAE", isItsVerified: true, isDummy: true, hobbies: "Reading, Painting", partnerQualities: "Respectful, caring, and financially stable.", bio: "Software engineer who loves reading and exploring new tech.", heightFeet: "5", heightInch: "6" },
                        { id: "dummy3", name: "Zahra", dob: "1999-11-20", jamaat: "Husaini Jamaat, London", education: "Doctor of Medicine", hizratLocation: "London, UK", isItsVerified: true, isDummy: true, hobbies: "Photography, Swimming", partnerQualities: "Family-oriented and supportive.", bio: "Dedicated doctor with a passion for helping others.", heightFeet: "5", heightInch: "2" }
                    ];
                }
                setDiscoveryProfiles(profiles);
            } catch (err) {
                console.error("Discovery Error", err);
            }
        });

        setupRequestsListeners();

        return () => {
            unsubMe();
            if (unsubOutgoing) unsubOutgoing();
            if (unsubIncoming) unsubIncoming();
        };

    }, [user, loading, router]);


    const handleRequestAction = async (requestId: string, newStatus: string) => {
        // Mock action for dummy requests, don't execute transaction
        if (requestId.includes('dummy')) {
            toast.success(`Demo Request ${newStatus}!`);
            setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
            return;
        }

        try {
            await updateDoc(doc(db, "rishta_requests", requestId), {
                status: newStatus
            });

            // Optimistic UI update
            setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));

            if (newStatus === "rejected") {
                toast(
                    (t) => (
                        <div className="flex items-center gap-3">
                            <span>Request declined.</span>
                            <button
                                onClick={async () => {
                                    toast.dismiss(t.id);
                                    try {
                                        await updateDoc(doc(db, "rishta_requests", requestId), { status: "pending_response" });
                                        setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "pending_response" } : r));
                                        toast.success("Decline reversed, request is pending again.");
                                    } catch (e) {
                                        toast.error("Failed to reverse action.");
                                    }
                                }}
                                className="bg-gray-200 px-3 py-1 rounded text-xs font-bold text-gray-700 hover:bg-gray-300"
                            >
                                UNDO
                            </button>
                        </div>
                    ),
                    { duration: 5000, icon: '⚠️' }
                );
            } else {
                toast.success(`Request ${newStatus}!`);
            }
        } catch (error: any) {
            toast.error("Action failed: " + error.message);
        }
    };

    const handleAcceptClick = (req: RishtaRequest) => {
        setAcceptError('');
        setAcceptMobile(myProfile?.mobile ? `${myProfile.mobileCode || ''} ${myProfile.mobile}`.trim() : '');
        setAcceptEmail(myProfile?.email || '');
        setAcceptingRequest(req);
    };

    const confirmAcceptRequest = async () => {
        setAcceptError('');
        if (!acceptMobile || !acceptEmail) {
            setAcceptError("Mobile and Email are compulsory to share when accepting.");
            return;
        }
        if (!user || !acceptingRequest) return;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                mobile: acceptMobile,
                email: acceptEmail
            });
            await handleRequestAction(acceptingRequest.id, "accepted");
            setAcceptingRequest(null);
        } catch (err: any) {
            toast.error("Failed to accept: " + err.message);
        }
    };


    const handleUpgradeToPremium = async () => {
        if (!user) return;
        try {
            setPaying(true);
            // MOCK TRANSACTION DB CALL
            await updateDoc(doc(db, "users", user.uid), {
                isPremium: true,
                premiumSince: new Date().toISOString()
            });
            toast.success("Payment Successful! ₹53/mo plan active.", { icon: '🎉' });
            setShowPremiumModal(false);
        } catch (err: any) {
            toast.error("Payment failed: " + err.message);
        } finally {
            setPaying(false);
        }
    };

    const renderTabContent = () => {
        if (dataLoading) {
            return (
                <section className={`${activeTab === 'discovery' ? 'lg:col-span-3' : 'lg:col-span-4'} flex items-center justify-center p-24`}>
                    <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
                </section>
            );
        }

        if (myProfile?.status === 'rejected') {
            return (
                <section className={`${activeTab === 'discovery' ? 'lg:col-span-3' : 'lg:col-span-4'} flex items-center justify-center p-12`}>
                    <div className="bg-red-50 p-12 rounded-3xl shadow-sm text-center border border-red-100 flex flex-col items-center">
                        <X className="w-16 h-16 text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-red-700 mb-2">Biodata Verification Rejected</h2>
                        <p className="text-red-600 max-w-md">Your ITS verification was rejected by an administrator. Please contact support or retry the verification process if you believe this is an error.</p>
                    </div>
                </section>
            );
        }

        switch (activeTab) {
            case 'requests':
                const pendingRequests = allRequests.filter(r => r.status === "pending_response");
                return (
                    <section className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Interest Requests</h2>
                        </div>
                        {pendingRequests.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
                                <ShieldCheck className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">No active pending requests.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pendingRequests.map((req) => (
                                    <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-gradient-to-br from-[#881337] to-[#D4AF37] opacity-80 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-sm text-xl relative overflow-hidden shrink-0">
                                                {req.otherUserLibasUrl ? (
                                                    <img src={req.otherUserLibasUrl} alt="User" className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${req.otherUserBlurSecurityEnabled ? 'blur-md scale-110 opacity-70' : 'opacity-100 scale-100'}`} />
                                                ) : (
                                                    <span className="z-10 relative">{req.otherUserName.charAt(0)}</span>
                                                )}
                                                {req.otherUserBlurSecurityEnabled && !req.otherUserLibasUrl && <div className="absolute inset-0 backdrop-blur-md"></div>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-[#881337]">{req.otherUserName}, {req.otherUserAge}</h4>
                                                <p className="text-sm text-gray-500">{req.otherUserLocation}</p>
                                            </div>
                                        </div>
                                        {req.isIncoming ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRequestAction(req.id, "rejected")} className="bg-red-50 text-red-600 p-3 rounded-full hover:bg-red-100 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                                                <button onClick={() => handleAcceptClick(req)} className="bg-[#881337] text-white p-3 rounded-full hover:bg-[#9F1239] transition-colors shadow-md"><Check className="w-5 h-5" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 items-center text-gray-500 text-sm font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                                                <Clock className="w-4 h-4" /> Sent
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            case 'messages':
                const acceptedRequests = allRequests.filter(r => r.status === "accepted");

                if (activeChat) {
                    return (
                        <section className="lg:col-span-4">
                            <ChatWindow
                                connectionId={activeChat.id}
                                otherUserName={activeChat.name}
                                otherUserImageUrl={activeChat.imageUrl}
                                onClose={() => setActiveChat(null)}
                            />
                        </section>
                    );
                }

                return (
                    <section className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold font-serif mb-6">Unblurred Alignments</h2>
                        {acceptedRequests.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
                                <MessageCircle className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">No accepted interest requests yet.</p>
                                <p className="text-gray-400 text-sm mt-2">When a request is approved, their photos unblur and you can chat here!</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                                {acceptedRequests.map((msg) => (
                                    <div key={msg.id} className="p-5 flex flex-col md:flex-row items-start md:items-center gap-5 hover:bg-gray-50 transition-colors relative">

                                        <div className="flex flex-col items-center shrink-0">
                                            <div className="w-20 h-20 bg-rose-50 text-[#881337] rounded-full flex items-center justify-center text-xl font-bold border border-rose-100 relative overflow-hidden mb-2">
                                                {/* Because it is ACCEPTED, photos unblur and are shown! */}
                                                {msg.otherUserLibasUrl ? (
                                                    <img src={msg.otherUserLibasUrl} alt="Match" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{msg.otherUserName.charAt(0)}</span>
                                                )}
                                                {msg.isIncoming && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{msg.otherUserLocation.split(',')[0]}</p>
                                                <p className="text-xs text-[#881337] font-medium max-w-[100px] truncate">{msg.otherUserEducation}</p>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full mt-4 md:mt-0">
                                            <div className="flex justify-between items-start md:items-center mb-1">
                                                <div>
                                                    <h4 className="font-bold text-lg text-[#881337]">{msg.otherUserName}</h4>
                                                    <div className="flex items-center gap-3 text-sm text-gray-600 font-medium mt-1">
                                                        <span>📞 {msg.otherUserMobile}</span>
                                                        <span className="hidden sm:inline">|</span>
                                                        <span>✉️ {msg.otherUserEmail}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-xs ${msg.isIncoming ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-1 rounded-full' : 'text-gray-400'}`}>Accepted Matched</span>
                                            </div>
                                            <p className={`text-sm ${msg.isIncoming ? 'text-gray-900 font-bold' : 'text-gray-500'} mb-4 mt-2`}>Alhamdulillah, Interest Request Accepted! Direct contact info is now visible.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (myProfile?.isPremium) {
                                                            setActiveChat({ id: msg.id, name: msg.otherUserName, imageUrl: msg.otherUserLibasUrl || undefined });
                                                        } else {
                                                            setShowPremiumModal(true);
                                                        }
                                                    }}
                                                    className="bg-[#881337] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#9F1239] transition-all flex items-center gap-2">
                                                    <MessageCircle className="w-4 h-4" /> Start Protected Chat
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm("Are you sure you want to end this connection?")) {
                                                            handleRequestAction(msg.id, "rejected");
                                                        }
                                                    }}
                                                    className="bg-white border text-red-600 border-red-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-50 transition-all flex items-center gap-2">
                                                    <X className="w-4 h-4" /> End Connection
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            case 'discovery':
            default:
                // Filter out profiles where there is already an accepted connection or the user is the sender of a pending request
                const hiddenProfileIds = new Set<string>();
                allRequests.forEach(r => {
                    if (r.status === "accepted") {
                        // Hide accepted connections from discovery (they appear in Messages)
                        const otherId = r.isIncoming ? r.from : r.to;
                        hiddenProfileIds.add(otherId);
                    }
                });

                const computeMatchScore = (me: any, them: any) => {
                    let score = 50;
                    if (!me || !them) return score;

                    if (me.country && them.country && me.country.toLowerCase() === them.country.toLowerCase()) score += 10;
                    if (me.state && them.state && me.state.toLowerCase() === them.state.toLowerCase()) score += 10;
                    if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) score += 10;

                    const myAge = me.dob ? new Date().getFullYear() - new Date(me.dob).getFullYear() : 25;
                    const theirAge = them.dob ? new Date().getFullYear() - new Date(them.dob).getFullYear() : 25;
                    const ageDiff = Math.abs(myAge - theirAge);

                    if (me.gender === 'male' && theirAge <= myAge && theirAge >= myAge - 6) score += 15;
                    else if (me.gender === 'female' && myAge <= theirAge && myAge >= theirAge - 6) score += 15;
                    else score -= Math.max(0, (ageDiff - 6) * 2);

                    const myHobbies = (me.hobbies || '').toLowerCase();
                    const theirHobbies = (them.hobbies || '').toLowerCase();
                    const myReqs = (me.partnerQualities || '').toLowerCase();
                    const theirReqs = (them.partnerQualities || '').toLowerCase();

                    if (myHobbies && theirHobbies) {
                        const hWords = myHobbies.split(/[,\s]+/).filter((w: string) => w.length > 3);
                        hWords.forEach((w: string) => {
                            if (theirHobbies.includes(w)) score += 5;
                        });
                    }

                    if (myReqs && (them.education || them.profession)) {
                        const rWords = myReqs.split(/[,\s]+/).filter((w: string) => w.length > 3);
                        let matched = false;
                        rWords.forEach((w: string) => {
                            if ((them.education || '').toLowerCase().includes(w) || (them.profession || '').toLowerCase().includes(w) || theirHobbies.includes(w)) {
                                matched = true;
                            }
                        });
                        if (matched) score += 10;
                    }

                    return Math.min(99, Math.max(30, score));
                };

                const availableProfiles = discoveryProfiles.filter(p => !hiddenProfileIds.has(p.id));

                const filteredProfiles = availableProfiles.filter(p =>
                    !searchQuery ||
                    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.jamaat?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.hizratLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.education?.toLowerCase().includes(searchQuery.toLowerCase())
                ).sort((a, b) => computeMatchScore(myProfile, b) - computeMatchScore(myProfile, a));

                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <h2 className="text-2xl font-bold font-serif">Community Discovery</h2>
                            <div className="flex gap-2 w-full md:w-auto">
                                <input
                                    type="text"
                                    placeholder="Search by name, jamaat, education..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="px-4 py-2 rounded-xl text-sm border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] w-full md:w-64"
                                />
                            </div>
                        </div>

                        {filteredProfiles.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100">
                                <p className="text-gray-500 font-bold">No new biodatas found dynamically.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
                                {filteredProfiles.map((p) => {
                                    // Check if this profile has a pending or accepted request from/to the current user
                                    const relatedReq = allRequests.find(r => {
                                        const otherId = r.isIncoming ? r.from : r.to;
                                        return otherId === p.id;
                                    });
                                    const isAccepted = relatedReq?.status === 'accepted';
                                    const blurEnabled = isAccepted ? false : (myProfile?.isBlurSecurityEnabled !== false);

                                    return (
                                        <DiscoveryCard
                                            key={p.id}
                                            {...p}
                                            isDummy={(p as any).isDummy}
                                            matchScore={computeMatchScore(myProfile, p)}
                                            isMyProfileVerified={myProfile?.isItsVerified === true}
                                            bio={p.bio}
                                            isBlurSecurityEnabled={blurEnabled}
                                            viewerItsNumber={myProfile?.itsNumber || ''}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#881337] p-6 pb-24 md:p-12 md:pb-12">
            <header className="max-w-7xl mx-auto mb-4 flex justify-center items-center bg-white p-2 rounded-2xl shadow-sm border border-gray-100 w-full">
                <nav className="flex w-full relative">
                    {(['mybiodata', 'discovery', 'requests', 'messages', 'notifications'] as const).map((tab) => (
                        <button
                            key={tab}
                            id={`${tab}-nav-tab`}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2.5 text-[10px] font-bold transition-all rounded-xl relative z-10 text-center ${activeTab === tab ? 'text-white shadow-sm' : 'text-gray-500 hover:text-[#881337]'}`}
                        >
                            {tab === 'mybiodata' ? 'Biodata'
                                : tab === 'messages' ? 'Chats'
                                    : tab === 'discovery' ? 'Search Profile'
                                        : tab === 'notifications' ? (
                                            <span className="relative">
                                                🔔
                                                {(adminMsgThread.length > 0 || showVerifiedCelebration || (myProfile?.status === 'rejected') || (myProfile?.status === 'hold')) && (
                                                    <span className="absolute -top-1 -right-2 w-2 h-2 bg-red-500 rounded-full" />
                                                )}
                                            </span>
                                        )
                                            : 'Requests'}
                        </button>
                    ))}
                    {/* Active Background Pill */}
                    <div
                        className="absolute top-0 bottom-0 w-1/5 bg-[#881337] rounded-xl transition-all duration-300 ease-out shadow-sm"
                        style={{ left: `${(['mybiodata', 'discovery', 'requests', 'messages', 'notifications'].indexOf(activeTab)) * 20}%` }}
                    />
                </nav>
            </header>

            {/* 🎉 Verified Celebration Banner */}
            {showVerifiedCelebration && (
                <div className="max-w-7xl mx-auto mb-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 shadow-lg overflow-hidden">
                    <div className="flex items-start gap-4 p-5 md:p-6">
                        <div className="text-4xl shrink-0 animate-bounce">🎊</div>
                        <div className="flex-1">
                            <h3 className="font-black text-xl text-emerald-800 mb-1">Mubarak! Your Profile is Successfully Verified ✨</h3>
                            <p className="text-emerald-700 text-sm leading-relaxed">
                                You can now send Rishta requests and access all the amazing features of this application.
                                May Allah bless you and help you find your Soulmate soon. <strong>Shukran! 🤲</strong>
                            </p>
                            <div className="flex gap-3 mt-3 flex-wrap">
                                <button onClick={() => { setActiveTab('discovery'); setShowVerifiedCelebration(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow transition-all">
                                    🌟 Start Discovering Matches
                                </button>
                                <button onClick={() => setShowVerifiedCelebration(false)} className="bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Admin Notification Banner (shown across all tabs) ── */}
            {myProfile && (myProfile.status === 'rejected' || myProfile.status === 'hold') && (
                <div className={`max-w-7xl mx-auto mb-5 rounded-2xl border-2 shadow-sm ${myProfile.status === 'rejected' ? 'bg-rose-50 border-rose-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-start justify-between gap-3 p-4 md:p-5">
                        <div className="flex gap-3 flex-1">
                            <div className="shrink-0 text-2xl mt-0.5">{myProfile.status === 'rejected' ? '⚠️' : '⏸️'}</div>
                            <div className="flex-1">
                                <h3 className={`font-black text-base mb-1 ${myProfile.status === 'rejected' ? 'text-[#881337]' : 'text-yellow-800'}`}>
                                    {myProfile.status === 'rejected' ? 'Action Required: Profile Needs Updates' : '⏸️ Your Profile is On Hold by Admin'}
                                </h3>
                                <p className="text-gray-700 text-sm mb-2">
                                    {myProfile.status === 'rejected'
                                        ? 'An Admin has reviewed your profile and requested some adjustments. Please fix the issue below and resubmit.'
                                        : 'See the Admin message below to understand what needs to be corrected to get your profile Accepted. You may also send a message to Admin by the below chat option.'}
                                </p>
                                {myProfile.adminMessage && (
                                    <div className={`px-4 py-3 rounded-xl text-sm italic font-medium border ${myProfile.status === 'rejected' ? 'bg-white border-rose-100 text-rose-800' : 'bg-white border-yellow-100 text-yellow-800'}`}>
                                        💬 "{myProfile.adminMessage}"
                                    </div>
                                )}
                                <div className="flex gap-3 mt-3 flex-wrap">
                                    {myProfile.status === 'rejected' && (
                                        <button onClick={() => router.push('/candidate-registration')} className="bg-[#881337] text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-rose-900 transition-all">
                                            ✏️ Update &amp; Resubmit Profile
                                        </button>
                                    )}
                                    {/* ITS Re-upload in banner for rejected/hold */}
                                    {!myProfile.isItsVerified && (
                                        <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5">
                                            📷 {itsReuploadUrl ? 'ITS Uploaded ✓' : 'Re-upload ITS Photo'}
                                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleITSReupload(f); }} />
                                        </label>
                                    )}
                                    <button
                                        onClick={() => setShowAdminMessages(!showAdminMessages)}
                                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        {showAdminMessages ? 'Hide' : 'Message Admin'}
                                        {adminMsgThread.length > 0 && <span className="bg-[#881337] text-white rounded-full px-1.5 text-[9px]">{adminMsgThread.length}</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Collapsible message thread */}
                    {showAdminMessages && (
                        <div className="border-t border-gray-200 p-4 md:p-5">
                            <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto mb-3 bg-white rounded-xl p-3 border border-gray-100">
                                {adminMsgThread.length === 0 && (
                                    <p className="text-center text-gray-400 text-xs py-4">No messages yet. Send a query below.</p>
                                )}
                                {adminMsgThread.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] px-3.5 py-2 rounded-xl text-sm shadow-sm ${msg.from === 'admin' ? 'bg-gray-100 text-gray-800 rounded-tl-sm' : 'bg-[#881337] text-white rounded-tr-sm'}`}>
                                            <p className="text-[10px] font-bold uppercase opacity-60 mb-0.5">{msg.from === 'admin' ? 'Admin' : 'You'}</p>
                                            <p>{msg.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={userMsgInput}
                                    onChange={e => setUserMsgInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSendMessageToAdmin(); }}
                                    placeholder="Write a query to admin..."
                                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#881337] bg-gray-50"
                                />
                                <button onClick={handleSendMessageToAdmin} className="bg-[#881337] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-900 transition-colors shadow-sm flex items-center gap-1.5">
                                    <Send className="w-4 h-4" /> Send
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <main className="max-w-7xl mx-auto">

                {/* MY BIODATA TAB */}
                {activeTab === 'mybiodata' && myProfile && (
                    <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">
                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-rose-50 mb-4 shadow-md relative">
                                {myProfile.itsImageUrl ? (
                                    <img src={myProfile.itsImageUrl} alt="Biodata" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-4xl">
                                        {myProfile.name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-2xl text-[#881337] text-center font-serif">{myProfile.name}</h3>
                            <p className="text-sm text-gray-500 mb-2">ITS: {myProfile.itsNumber} · {myProfile.jamaat}</p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-1 mb-4">
                                {myProfile.isItsVerified ? (
                                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-100"><Check className="w-3 h-3" /> ITS Verified</span>
                                ) : (
                                    <span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-yellow-100"><Clock className="w-3 h-3" /> ITS Pending</span>
                                )}
                                {user?.emailVerified || myProfile.isEmailVerified ? (
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-blue-100"><Check className="w-3 h-3" /> Email Verified</span>
                                ) : (
                                    <span onClick={async () => {
                                        const { sendEmailVerification } = require("firebase/auth");
                                        if (user) { try { await sendEmailVerification(user); toast.success("Verification Email Sent!"); } catch { toast.error("Try later."); } }
                                    }} className="bg-gray-50 text-gray-600 px-3 py-1 cursor-pointer hover:bg-gray-100 transition-colors rounded-full text-xs font-bold flex items-center gap-1 border border-gray-200"><Clock className="w-3 h-3" /> Verify Email</span>
                                )}
                            </div>

                            {/* Profile Completeness */}
                            {(() => {
                                const fields = ['name', 'itsNumber', 'gender', 'dob', 'jamaat', 'education', 'hizratLocation', 'libasImageUrl', 'fatherName', 'motherName', 'maritalStatus', 'mobile', 'address', 'professionType'];
                                let filled = 0;
                                fields.forEach(f => { if (myProfile[f] || (f === 'professionType' && myProfile['profession']) || (f === 'education' && myProfile['educationDetails'])) filled++; });
                                let pct = Math.floor((filled / fields.length) * 100);
                                if (myProfile.isCandidateFormComplete) pct = 100;
                                return (
                                    <div id="profile-completeness-section" className="w-full bg-gray-50 p-4 border border-gray-100 rounded-xl flex flex-col items-center">
                                        <div className="w-full flex justify-between text-xs font-bold text-gray-500 mb-2">
                                            <span>Biodata Completeness</span><span className="text-[#881337]">{pct}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                                            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#881337] transition-all duration-1000" style={{ width: `${pct}%` }} />
                                        </div>
                                        {pct < 100 && (
                                            <button onClick={() => router.push('/candidate-registration')} className="w-full bg-[#881337] text-white py-2.5 rounded-xl text-sm font-bold shadow hover:bg-[#9F1239] transition-all mt-1">Complete ITNC Registration Form</button>
                                        )}
                                        {pct >= 100 && !myProfile.isItsVerified && (
                                            <div className="w-full bg-yellow-50 text-yellow-700 py-2 rounded-lg text-xs font-bold text-center border border-yellow-200 mt-1">ITS Verification Pending — you can still browse</div>
                                        )}
                                        <button
                                            onClick={() => setShowMyProfileModal(true)}
                                            className="w-full bg-white text-[#881337] border border-[#881337]/20 hover:bg-rose-50 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all mt-3 flex items-center justify-center gap-1"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" /> Preview My Public Biodata
                                        </button>
                                        <button
                                            onClick={() => router.push('/candidate-registration')}
                                            className="w-full bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all mt-2 flex items-center justify-center gap-1"
                                        >
                                            ✏️ Edit My Biodata
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* NOTIFICATIONS TAB */}
                {activeTab === 'notifications' && (
                    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-lg font-black text-[#881337] uppercase tracking-widest mb-2">🔔 Notifications</h2>

                        {/* Verified celebration */}
                        {showVerifiedCelebration && (
                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl animate-bounce shrink-0">🎊</div>
                                <div className="flex-1">
                                    <p className="font-black text-emerald-800 text-base">Mubarak! Your Profile is Successfully Verified ✨</p>
                                    <p className="text-emerald-700 text-sm mt-1 leading-relaxed">You can now send Rishta requests and access all the amazing features. May Allah bless you and help you find your Soulmate soon. <strong>Shukran! 🤲</strong></p>
                                    <button onClick={() => { setActiveTab('discovery'); setShowVerifiedCelebration(false); }} className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all">🌟 Start Discovering</button>
                                </div>
                            </div>
                        )}

                        {/* Rejected alert */}
                        {myProfile?.status === 'rejected' && (
                            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl shrink-0">⚠️</div>
                                <div className="flex-1">
                                    <p className="font-black text-[#881337] text-base">Profile Verification Rejected</p>
                                    <p className="text-gray-700 text-sm mt-1">Your biodata verification was rejected. Please reapply with correct data to access the Send Request feature and all other features.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-rose-700 text-sm bg-white border border-rose-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}
                                    <button onClick={() => router.push('/candidate-registration')} className="mt-3 bg-[#881337] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-900 transition-all">✏️ Update &amp; Resubmit Profile</button>
                                </div>
                            </div>
                        )}

                        {/* Hold alert */}
                        {myProfile?.status === 'hold' && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl shrink-0">⏸️</div>
                                <div className="flex-1">
                                    <p className="font-black text-yellow-800 text-base">Profile On Hold</p>
                                    <p className="text-gray-700 text-sm mt-1">Your profile is temporarily on hold pending admin review.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-yellow-700 text-sm bg-white border border-yellow-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}
                                </div>
                            </div>
                        )}

                        {/* Admin Message Thread */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-[#881337]" />
                                <h3 className="font-bold text-sm text-[#881337] uppercase tracking-wide">💬 Chat with Admin to Resolve Above</h3>
                            </div>
                            <div className="flex flex-col gap-2.5 min-h-[120px] max-h-72 overflow-y-auto p-4">
                                {adminMsgThread.length === 0 ? (
                                    <p className="text-center text-gray-400 text-sm py-8">No messages from admin yet.</p>
                                ) : (
                                    adminMsgThread.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.from === 'admin' ? 'bg-gray-100 text-gray-800 rounded-tl-sm' : 'bg-[#881337] text-white rounded-tr-sm'}`}>
                                                <p className="text-[10px] font-bold uppercase opacity-60 mb-0.5">{msg.from === 'admin' ? 'Admin' : 'You'}</p>
                                                <p>{msg.text}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="flex gap-2 p-4 border-t border-gray-100 bg-gray-50/50">
                                <input
                                    type="text"
                                    value={userMsgInput}
                                    onChange={e => setUserMsgInput(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSendMessageToAdmin(); }}
                                    placeholder="Send a message to admin..."
                                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#881337] bg-white"
                                />
                                <button onClick={handleSendMessageToAdmin} className="bg-[#881337] text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-900 transition-colors shadow-sm flex items-center gap-1.5">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {adminMsgThread.length === 0 && !showVerifiedCelebration && myProfile?.status !== 'rejected' && myProfile?.status !== 'hold' && (
                            <div className="text-center py-12 text-gray-400">
                                <div className="text-5xl mb-3">🔔</div>
                                <p className="font-bold text-sm">All Caught Up!</p>
                                <p className="text-xs mt-1">No new notifications right now.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Discovery / Requests / Messages */}
                {activeTab !== 'mybiodata' && activeTab !== 'notifications' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {renderTabContent()}
                    </div>
                )}

            </main>


            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 pb-safe flex justify-around items-center z-50 shadow-2xl">
                <button onClick={() => setActiveTab('mybiodata')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'mybiodata' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Biodata</span>
                </button>
                <button onClick={() => setActiveTab('discovery')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'discovery' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <Heart className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Search</span>
                </button>
                <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'requests' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Requests</span>
                </button>
                <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'messages' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <MessageCircle className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Chats</span>
                    {allRequests.filter(r => r.status === 'accepted' && r.isIncoming).length > 0 && <span className="absolute -top-0.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                </button>
                <button onClick={() => setActiveTab('notifications')} className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'notifications' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <span className="text-xl leading-none">🔔</span>
                    <span className="text-[8px] font-bold uppercase">Alerts</span>
                    {(adminMsgThread.length > 0 || showVerifiedCelebration || myProfile?.status === 'rejected' || myProfile?.status === 'hold') && <span className="absolute -top-0.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                </button>
            </nav>

            {/* Premium Modal */}
            {
                showPremiumModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white max-w-sm w-full rounded-3xl overflow-hidden shadow-2xl">
                            <div className="bg-gradient-to-r from-[#D4AF37] to-[#F1D16A] p-6 text-center relative">
                                <button onClick={() => setShowPremiumModal(false)} className="absolute top-4 right-4 bg-black/10 rounded-full p-2 text-[#881337]"><X className="w-4 h-4" /></button>
                                <Sparkles className="w-12 h-12 text-[#881337] mx-auto mb-3" />
                                <h2 className="text-2xl font-bold text-[#881337] font-serif mb-1">Unlock Halal Chats</h2>
                                <p className="text-[#881337] opacity-90 text-sm font-medium">Unlimited Matches &amp; Chat</p>
                            </div>
                            <div className="p-8 text-center space-y-6">
                                <h3 className="text-4xl font-extrabold text-[#881337] flex justify-center items-start"><span className="text-xl mt-1">&#8377;</span>53<span className="text-base text-gray-500 font-normal mt-auto mb-1">/mo</span></h3>
                                <ul className="text-left text-sm text-gray-600 space-y-3 font-medium">
                                    <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> Encrypted end-to-end chat</li>
                                    <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> Dynamic profile photo unblurring</li>
                                    <li className="flex gap-2"><Check className="w-5 h-5 text-emerald-500 shrink-0" /> See who viewed your profile</li>
                                </ul>
                                <button onClick={handleUpgradeToPremium} disabled={paying} className="w-full bg-[#881337] hover:bg-[#9F1239] text-white py-4 rounded-xl font-bold shadow-md flex justify-center items-center gap-2">
                                    {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Pay Now (Mock)</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* My Profile Preview Modal */}
            {
                showMyProfileModal && myProfile && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowMyProfileModal(false)}>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="relative h-48 bg-gray-200 overflow-hidden shrink-0">
                                {myProfile.libasImageUrl ? <img src={myProfile.libasImageUrl} alt="Profile" className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-80" /> : <div className="absolute inset-0 bg-gray-300" />}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
                                <button onClick={() => setShowMyProfileModal(false)} className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-2 z-20"><X className="w-4 h-4" /></button>
                                <div className="absolute bottom-6 left-6 z-10">
                                    <h2 className="text-3xl font-bold font-serif text-white">{myProfile.name}, {myProfile.dob ? Math.floor((Date.now() - new Date(myProfile.dob).getTime()) / 31557600000) : '--'}</h2>
                                    <p className="text-[#D4AF37] font-medium flex items-center gap-2 mt-1"><CheckCircle className="w-4 h-4" /> {myProfile.isItsVerified ? 'ITS Verified' : 'Unverified'}</p>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-gray-400 text-xs font-bold mb-1">Jamaat</p><p className="text-[#881337] font-semibold text-sm">{myProfile.jamaat || 'N/A'}</p></div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100"><p className="text-gray-400 text-xs font-bold mb-1">Location</p><p className="text-[#881337] font-semibold text-sm">{myProfile.hizratLocation || 'N/A'}</p></div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Profession</p><p className="text-[#881337] font-semibold text-sm">{myProfile.professionType || myProfile.profession || 'N/A'}</p></div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Hobbies</p><p className="text-[#881337] font-semibold text-sm">{myProfile.hobbies || 'Not specified'}</p></div>
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2"><p className="text-gray-400 text-xs font-bold mb-1">Partner Qualities</p><p className="text-[#881337] font-semibold text-sm">{myProfile.partnerQualities || 'Not specified'}</p></div>
                                </div>
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
                                    <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-700">Photos and contact info remain blurred until an interest is mutually accepted.</p>
                                </div>
                            </div>
                            <div className="p-5 border-t shrink-0">
                                <button onClick={() => { setShowMyProfileModal(false); router.push('/candidate-registration'); }} className="w-full py-3 rounded-xl font-bold bg-[#D4AF37] text-white hover:bg-[#c29e2f]">Edit Profile Details</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Accept Request Modal */}
            {
                acceptingRequest && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
                            <h3 className="text-2xl font-bold font-serif text-[#881337] mb-2">Accept Interest Request</h3>
                            <p className="text-sm text-gray-600 mb-6">Accepting from <span className="font-bold">{acceptingRequest.otherUserName}</span>. Confirm contact details to share.</p>
                            <div className="space-y-4 mb-6">
                                {acceptError && <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">{acceptError}</div>}
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number *</label><input value={acceptMobile} onChange={e => { setAcceptMobile(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. +91 9876543210" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Email Address *</label><input type="email" value={acceptEmail} onChange={e => { setAcceptEmail(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. you@example.com" /></div>
                                <div className="flex gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                    <Info className="w-4 h-4 text-[#881337] shrink-0 mt-0.5" /><p className="text-xs text-[#881337] font-medium">These details will be shared mutually upon acceptance.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setAcceptingRequest(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                                <button onClick={confirmAcceptRequest} className="flex-1 py-3 bg-[#D4AF37] text-white font-bold rounded-xl hover:bg-[#c29e2f] shadow-md">Confirm &amp; Accept</button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
