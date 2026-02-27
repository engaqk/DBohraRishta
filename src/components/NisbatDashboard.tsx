"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DiscoveryCard from './DiscoveryCard';
import PrivacyToggle from './PrivacyToggle';
import { Sparkles, MessageCircle, ShieldCheck, Heart, LogOut, X, Check, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';

interface UserProfile {
    id: string;
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    hizratLocation?: string;
    isItsVerified?: boolean;
}

interface NisbatRequest {
    id: string;
    from: string;
    to: string;
    status: string;
    isIncoming: boolean;
    // Resolved Data
    otherUserName: string;
    otherUserAge: number;
    otherUserLocation: string;
}

export default function NisbatDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    // UI State
    const [activeTab, setActiveTab] = useState<'discovery' | 'requests' | 'messages'>('discovery');
    const [dataLoading, setDataLoading] = useState(true);

    // Live Data State
    const [discoveryProfiles, setDiscoveryProfiles] = useState<UserProfile[]>([]);
    const [allRequests, setAllRequests] = useState<NisbatRequest[]>([]);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const loadDiscovery = async () => {
            try {
                // Production level: Real queries would paginate.
                // We're querying users who are ITS Verified, and optionally excluding ourselves.
                // For safety in this mockup without strict indexing yet, we'll fetch verified and filter client side.
                const q = query(collection(db, "users"), where("isItsVerified", "==", true));
                const snap = await getDocs(q);
                let profiles: UserProfile[] = [];
                snap.forEach(doc => {
                    if (doc.id !== user.uid) {
                        profiles.push({ id: doc.id, ...doc.data() } as UserProfile);
                    }
                });

                // If the user isn't verified or there are none, we fallback to our dummy profiles to ensure the UI ALWAYS shines for demo purposes!
                if (profiles.length === 0) {
                    profiles = [
                        { id: "dummy1", name: "Aliya", dob: "1998-05-15", jamaat: "Colpetty Jamaat, Colombo", education: "MBA in Finance", hizratLocation: "Colombo, LK", isItsVerified: true },
                        { id: "dummy2", name: "Fatima", dob: "2000-02-10", jamaat: "Saifee Park Jamaat, Dubai", education: "Software Engineer", hizratLocation: "Dubai, UAE", isItsVerified: true },
                        { id: "dummy3", name: "Zahra", dob: "1999-11-20", jamaat: "Husaini Jamaat, London", education: "Doctor of Medicine", hizratLocation: "London, UK", isItsVerified: true }
                    ];
                }
                setDiscoveryProfiles(profiles);
            } catch (err) {
                console.error("Discovery Error", err);
            }
        };

        const subscribeToRequests = () => {
            // To simplify index requirements on Firebase free tier without creating composite indexes, 
            // we will use onSnapshot to listen to incoming separately, or fetch normally.
            // We'll fetch normally for simplicity in UI testing.
            const fetchRequests = async () => {
                try {
                    const outgoingQ = query(collection(db, "nisbat_requests"), where("from", "==", user.uid));
                    const incomingQ = query(collection(db, "nisbat_requests"), where("to", "==", user.uid));

                    const [outSnap, inSnap] = await Promise.all([getDocs(outgoingQ), getDocs(incomingQ)]);

                    let requestsRaw: any[] = [];

                    outSnap.forEach(d => requestsRaw.push({ id: d.id, isIncoming: false, ...d.data() }));
                    inSnap.forEach(d => requestsRaw.push({ id: d.id, isIncoming: true, ...d.data() }));

                    // Resolve the other user's names
                    const resolvedRequests: NisbatRequest[] = [];

                    for (const req of requestsRaw) {
                        const targetId = req.isIncoming ? req.from : req.to;
                        // Don't query dummy IDs
                        if (targetId.startsWith("dummy")) {
                            resolvedRequests.push({
                                ...req,
                                otherUserName: targetId === "dummy1" ? "Aliya" : targetId === "dummy2" ? "Fatima" : "Zahra",
                                otherUserAge: 25,
                                otherUserLocation: "Global",
                            });
                            continue;
                        }

                        const uRef = await getDoc(doc(db, "users", targetId));
                        if (uRef.exists()) {
                            const uData = uRef.data();
                            resolvedRequests.push({
                                ...req,
                                otherUserName: uData.name || "Unknown Member",
                                otherUserAge: uData.dob ? Math.floor((new Date().getTime() - new Date(uData.dob).getTime()) / 31557600000) : 25,
                                otherUserLocation: uData.hizratLocation || "Global Network"
                            });
                        }
                    }

                    setAllRequests(resolvedRequests.sort((a, b) => b.status.localeCompare(a.status)));
                } catch (err) {
                    console.error("Requests Error", err);
                } finally {
                    setDataLoading(false);
                }
            };

            fetchRequests();
            // Normally we'd use onSnapshot, but intervals or manual refreshes are safer out-of-the-box for unconfigured indexes
            const interval = setInterval(fetchRequests, 15000);
            return () => clearInterval(interval);
        };

        loadDiscovery();
        const unsubRequests = subscribeToRequests();
        return () => unsubRequests();

    }, [user, loading, router]);


    const handleRequestAction = async (requestId: string, newStatus: string) => {
        try {
            await updateDoc(doc(db, "nisbat_requests", requestId), {
                status: newStatus
            });
            toast.success(`Request ${newStatus}!`);
            // Optimistic UI update
            setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
        } catch (error: any) {
            toast.error("Action failed: " + error.message);
        }
    };


    const renderTabContent = () => {
        if (dataLoading) {
            return (
                <section className="lg:col-span-3 flex items-center justify-center p-24">
                    <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
                </section>
            );
        }

        switch (activeTab) {
            case 'requests':
                const pendingRequests = allRequests.filter(r => r.status === "pending_response");
                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Nisbat Requests</h2>
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
                                                <div className="absolute inset-0 backdrop-blur-md"></div>
                                                <span className="z-10">{req.otherUserName.charAt(0)}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-[#881337]">{req.otherUserName}, {req.otherUserAge}</h4>
                                                <p className="text-sm text-gray-500">{req.otherUserLocation}</p>
                                            </div>
                                        </div>
                                        {req.isIncoming ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRequestAction(req.id, "rejected")} className="bg-red-50 text-red-600 p-3 rounded-full hover:bg-red-100 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                                                <button onClick={() => handleRequestAction(req.id, "accepted")} className="bg-[#881337] text-white p-3 rounded-full hover:bg-[#9F1239] transition-colors shadow-md"><Check className="w-5 h-5" /></button>
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
                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold font-serif mb-6">Unblurred Alignments</h2>
                        {acceptedRequests.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
                                <MessageCircle className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">No accepted Nisbat requests yet.</p>
                                <p className="text-gray-400 text-sm mt-2">When a request is approved, their photos unblur and you can chat here!</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                                {acceptedRequests.map((msg) => (
                                    <div key={msg.id} className="p-5 flex items-center gap-5 hover:bg-gray-50 cursor-pointer transition-colors relative">

                                        <div className="w-14 h-14 bg-rose-50 text-[#881337] rounded-full flex items-center justify-center text-xl font-bold border border-rose-100 relative shrink-0">
                                            {/* Because it is ACCEPTED, photos would technically unblur here in a full app */}
                                            {msg.otherUserName.charAt(0)}
                                            {msg.isIncoming && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="font-bold text-lg text-[#881337]">{msg.otherUserName}</h4>
                                                <span className={`text-xs ${msg.isIncoming ? 'text-[#881337] font-bold' : 'text-gray-400'}`}>New Match!</span>
                                            </div>
                                            <p className={`text-sm ${msg.isIncoming ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>Alhamdulillah, Nisbat Request Accepted!</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            case 'discovery':
            default:
                // Filter out profiles we already requested!
                const pendingOrAcceptedTo = allRequests.map(r => r.to);
                const availableProfiles = discoveryProfiles.filter(p => !pendingOrAcceptedTo.includes(p.id));

                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Community Discovery</h2>
                            <div className="flex gap-2">
                                <button className="bg-white px-4 py-2 rounded-full text-sm font-medium border border-gray-200 shadow-sm hover:border-[#D4AF37] transition-colors">Filters</button>
                            </div>
                        </div>

                        {availableProfiles.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100">
                                <p className="text-gray-500 font-bold">No new profiles to discover in your area right now.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
                                {availableProfiles.map((p) => (
                                    <DiscoveryCard key={p.id} {...p} matchScore={Math.floor(Math.random() * 20) + 75} />
                                ))}
                            </div>
                        )}
                    </section>
                );
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#881337] p-6 pb-24 md:p-12 md:pb-12">
            <header className="max-w-7xl mx-auto mb-12 flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#881337] text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-2 border-[#D4AF37]">
                        DN
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-[#881337]">dbohranisbat.com</h1>
                        <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Nisbat over Shaadi</p>
                    </div>
                </div>
                <nav className="hidden md:flex gap-6 items-center font-bold text-sm">
                    <button onClick={() => setActiveTab('discovery')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'discovery' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#881337] border-transparent'}`}>Discovery</button>
                    <button onClick={() => setActiveTab('requests')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'requests' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#881337] border-transparent'}`}>Requests</button>
                    <button onClick={() => setActiveTab('messages')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'messages' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#881337] border-transparent'}`}>Messages</button>
                    {user ? (
                        <button onClick={logout} className="ml-4 text-red-500 hover:text-red-600 transition-colors flex items-center gap-2">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden lg:inline">Logout</span>
                        </button>
                    ) : (
                        <button onClick={() => router.push('/login')} className="ml-4 text-[#D4AF37] hover:text-[#c29e2f] transition-colors flex items-center gap-2 font-bold">
                            Login / Setup
                        </button>
                    )}
                </nav>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Left Sidebar / Privacy & AI Coaching */}
                <aside className="lg:col-span-1 space-y-6">
                    <PrivacyToggle />

                    <div className="bg-gradient-to-br from-[#881337] to-[#9F1239] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <Sparkles className="w-16 h-16" />
                        </div>
                        <h3 className="text-xl font-bold font-serif mb-2 flex items-center">
                            Aunty Intelligence 2.0
                        </h3>
                        <p className="text-sm opacity-90 mb-6 leading-relaxed">
                            Based on your preferences, AI suggests focusing on matches in healthcare or finance to align with your Dunyawi goals.
                        </p>
                        <div className="bg-white/10 p-4 rounded-xl backdrop-blur-md">
                            <h4 className="font-bold text-xs uppercase tracking-wider mb-2 text-[#D4AF37]">Halal Icebreaker</h4>
                            <p className="text-sm italic">
                                "I noticed you are currently based in Dubai. How do you find the balance of Deeni and Dunyawi life there?"
                            </p>
                        </div>
                    </div>
                </aside>

                {/* Main Content Render */}
                {renderTabContent()}

            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe flex justify-around items-center z-50 shadow-2xl">
                <button onClick={() => setActiveTab('discovery')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'discovery' ? 'text-[#881337]' : 'text-gray-400 hover:text-[#881337]'}`}>
                    <Heart className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Discovery</span>
                </button>
                <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'requests' ? 'text-[#881337]' : 'text-gray-400 hover:text-[#881337]'}`}>
                    <ShieldCheck className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Requests</span>
                </button>
                <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center gap-1 transition-colors relative ${activeTab === 'messages' ? 'text-[#881337]' : 'text-gray-400 hover:text-[#881337]'}`}>
                    <MessageCircle className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
                    {/* Tiny Notification Dot Example */}
                    {allRequests.filter(r => r.status === 'accepted' && r.isIncoming).length > 0 && <span className="absolute top-0 right-2 w-2 h-2 bg-red-500 rounded-full"></span>}
                </button>
            </nav>
        </div>
    );
}
