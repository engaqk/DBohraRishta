"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import DiscoveryCard from './DiscoveryCard';
import PrivacyToggle from './PrivacyToggle';
import { Sparkles, MessageCircle, ShieldCheck, Heart, LogOut, X, Check, Clock } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function NisbatDashboard() {
    const { logout } = useAuth();
    const router = useRouter();

    // UI State for tabs
    const [activeTab, setActiveTab] = useState<'discovery' | 'requests' | 'messages'>('discovery');

    // Mock Data
    const dummyProfiles = [
        { name: "Aliya", age: 26, jamaat: "Colpetty Jamaat, Colombo", education: "MBA in Finance", location: "Colombo, LK", matchScore: 92 },
        { name: "Fatima", age: 24, jamaat: "Saifee Park Jamaat, Dubai", education: "Software Engineer", location: "Dubai, UAE", matchScore: 88 },
        { name: "Zahra", age: 25, jamaat: "Husaini Jamaat, London", education: "Doctor of Medicine", location: "London, UK", matchScore: 85 }
    ];

    const dummyRequests = [
        { id: 1, name: "Sakina", age: 26, location: "Mumbai, IN", status: "pending_incoming", matchScore: 94 },
        { id: 2, name: "Arwa", age: 28, location: "Sharjah, UAE", status: "pending_outgoing", matchScore: 78 },
    ];

    const dummyMessages = [
        { id: 1, name: "Fatima", lastMessage: "Yes, I agree. Dunyawi balance is important.", time: "2h ago", unread: true },
        { id: 2, name: "Zahra", lastMessage: "InshaAllah we can speak tomorrow.", time: "1d ago", unread: false },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'requests':
                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Nisbat Requests</h2>
                        </div>
                        <div className="grid gap-4">
                            {dummyRequests.map((req) => (
                                <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-gradient-to-br from-[#064E3B] to-[#D4AF37] opacity-80 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-sm text-xl relative overflow-hidden">
                                            {/* Simulated Blur Profile Pic */}
                                            <div className="absolute inset-0 backdrop-blur-md"></div>
                                            <span className="z-10">{req.name.charAt(0)}</span>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-[#064E3B]">{req.name}, {req.age}</h4>
                                            <p className="text-sm text-gray-500 flex items-center gap-2">
                                                {req.location}
                                                <span className="bg-emerald-50 text-[#064E3B] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">{req.matchScore}% Match</span>
                                            </p>
                                        </div>
                                    </div>
                                    {req.status === "pending_incoming" ? (
                                        <div className="flex gap-2">
                                            <button className="bg-red-50 text-red-600 p-3 rounded-full hover:bg-red-100 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                                            <button className="bg-[#064E3B] text-white p-3 rounded-full hover:bg-[#0a6b52] transition-colors shadow-md"><Check className="w-5 h-5" /></button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2 items-center text-gray-500 text-sm font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                                            <Clock className="w-4 h-4" /> Pending Response
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                );
            case 'messages':
                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold font-serif mb-6">Unblurred Alignments</h2>
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                            {dummyMessages.map((msg) => (
                                <div key={msg.id} className="p-5 flex items-center gap-5 hover:bg-gray-50 cursor-pointer transition-colors">
                                    <div className="w-14 h-14 bg-emerald-50 text-[#064E3B] rounded-full flex items-center justify-center text-xl font-bold border border-emerald-100 relative">
                                        {msg.name.charAt(0)}
                                        {msg.unread && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-lg text-[#064E3B]">{msg.name}</h4>
                                            <span className={`text-xs ${msg.unread ? 'text-[#064E3B] font-bold' : 'text-gray-400'}`}>{msg.time}</span>
                                        </div>
                                        <p className={`text-sm ${msg.unread ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>{msg.lastMessage}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            case 'discovery':
            default:
                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Community Discovery</h2>
                            <div className="flex gap-2">
                                <button className="bg-white px-4 py-2 rounded-full text-sm font-medium border border-gray-200 shadow-sm hover:border-[#D4AF37] transition-colors">Filters</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
                            {dummyProfiles.map((p, i) => (
                                <DiscoveryCard key={i} {...p} />
                            ))}
                        </div>
                    </section>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#064E3B] p-6 pb-24 md:p-12 md:pb-12">
            <header className="max-w-7xl mx-auto mb-12 flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#064E3B] text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg border-2 border-[#D4AF37]">
                        DN
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold font-serif text-[#064E3B]">dbohranisbat.com</h1>
                        <p className="text-sm font-medium text-gray-500 tracking-wide uppercase">Nisbat over Shaadi</p>
                    </div>
                </div>
                <nav className="hidden md:flex gap-6 items-center font-bold text-sm">
                    <button onClick={() => setActiveTab('discovery')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'discovery' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#064E3B] border-transparent'}`}>Discovery</button>
                    <button onClick={() => setActiveTab('requests')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'requests' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#064E3B] border-transparent'}`}>Requests</button>
                    <button onClick={() => setActiveTab('messages')} className={`transition-colors pb-1 border-b-2 hover:border-[#D4AF37] ${activeTab === 'messages' ? 'text-[#D4AF37] border-[#D4AF37]' : 'text-[#064E3B] border-transparent'}`}>Messages</button>
                    <button onClick={logout} className="ml-4 text-red-500 hover:text-red-600 transition-colors flex items-center gap-2">
                        <LogOut className="w-4 h-4" />
                        <span className="hidden lg:inline">Logout</span>
                    </button>
                </nav>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Left Sidebar / Privacy & AI Coaching */}
                <aside className="lg:col-span-1 space-y-6">
                    <PrivacyToggle />

                    <div className="bg-gradient-to-br from-[#064E3B] to-[#0a6b52] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
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
                <button onClick={() => setActiveTab('discovery')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'discovery' ? 'text-[#064E3B]' : 'text-gray-400 hover:text-[#064E3B]'}`}>
                    <Heart className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Discovery</span>
                </button>
                <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'requests' ? 'text-[#064E3B]' : 'text-gray-400 hover:text-[#064E3B]'}`}>
                    <ShieldCheck className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Requests</span>
                </button>
                <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center gap-1 transition-colors relative ${activeTab === 'messages' ? 'text-[#064E3B]' : 'text-gray-400 hover:text-[#064E3B]'}`}>
                    <MessageCircle className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
                    <span className="absolute top-0 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </nav>
        </div>
    );
}
