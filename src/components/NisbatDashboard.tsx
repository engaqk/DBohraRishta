"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DiscoveryCard from './DiscoveryCard';
import PrivacyToggle from './PrivacyToggle';
import { Sparkles, MessageCircle, ShieldCheck, Heart, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

export default function NisbatDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    // useEffect(() => {
    //     if (!loading && !user) {
    //         router.push('/login');
    //     }
    // }, [user, loading, router]);
    const dummyProfiles = [
        {
            name: "Aliya",
            age: 26,
            jamaat: "Colpetty Jamaat, Colombo",
            education: "MBA in Finance",
            location: "Colombo, LK",
            matchScore: 92
        },
        {
            name: "Fatima",
            age: 24,
            jamaat: "Saifee Park Jamaat, Dubai",
            education: "Software Engineer",
            location: "Dubai, UAE",
            matchScore: 88
        },
        {
            name: "Zahra",
            age: 25,
            jamaat: "Husaini Jamaat, London",
            education: "Doctor of Medicine",
            location: "London, UK",
            matchScore: 85
        }
    ];

    // if (loading) return null; // Or a nice full-page spinner

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
                    <a href="#" className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">Discovery</a>
                    <a href="#" className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">Requests</a>
                    <a href="#" className="hover:text-[#D4AF37] transition-colors pb-1 border-b-2 border-transparent hover:border-[#D4AF37]">Messages</a>
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

                {/* Main Content / Discovery */}
                <section className="lg:col-span-3">
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
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-safe flex justify-around items-center z-50 shadow-2xl">
                <button className="flex flex-col items-center gap-1 text-[#064E3B]">
                    <Heart className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Discovery</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#064E3B] transition-colors">
                    <ShieldCheck className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Requests</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#064E3B] transition-colors relative">
                    <MessageCircle className="w-6 h-6" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </nav>
        </div>
    );
}
