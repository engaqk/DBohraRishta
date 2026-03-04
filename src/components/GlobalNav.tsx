"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Home, User, LogOut, Bell } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function GlobalNav() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Listen for notifications (admin messages)
    useEffect(() => {
        if (!user) return;
        const msgRef = collection(db, 'admin_messages', user.uid, 'thread');
        const q = query(msgRef, orderBy('createdAt', 'asc'));

        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => d.data());
            const lastRead = localStorage.getItem(`lastReadNotif_${user.uid}`) || '0';
            const newUnread = msgs.filter(m => {
                if (m.from !== 'admin') return false;
                const ts = m.createdAt?.toMillis?.() || m.createdAt?.seconds * 1000 || 0;
                return ts > parseInt(lastRead);
            }).length;
            setUnreadCount(newUnread);
        });

        return () => unsub();
    }, [user]);

    // Auto-close mobile menu on route change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Don't show nav on login or onboarding
    if (pathname === '/login' || pathname === '/onboarding') return null;

    const handleLogout = async () => {
        setIsOpen(false);
        await logout();
        router.push('/login');
    };

    const isActive = (path: string) => pathname === path;

    return (
        <div className="fixed top-0 left-0 w-full z-[100] bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm print:hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => router.push('/')}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] border-2 border-[#D4AF37] flex items-center justify-center font-bold text-sm shadow-sm ring-2 ring-[#881337]/5">
                            53
                        </div>
                        <span className="font-serif font-bold text-[#881337] tracking-tight text-lg">DBohra<span className="font-light italic">Rishta</span></span>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-4">
                        {user && (
                            <button
                                onClick={() => router.push('/?tab=notifications')}
                                className="relative p-2 text-gray-500 hover:text-[#881337] transition-colors"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                                )}
                            </button>
                        )}
                        {user ? (
                            <>
                                <button onClick={() => router.push('/')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/') ? 'text-[#881337] bg-rose-50 font-bold' : 'text-gray-600 hover:text-[#881337] hover:bg-gray-50'}`}>
                                    <Home className="w-4 h-4" /> Dashboard
                                </button>
                                <button onClick={() => router.push('/candidate-registration')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/candidate-registration') ? 'text-[#881337] bg-rose-50 font-bold' : 'text-gray-600 hover:text-[#881337] hover:bg-gray-50'}`}>
                                    <User className="w-4 h-4" /> My Biodata
                                </button>
                                <button onClick={handleLogout} className="text-red-600 flex items-center gap-1 hover:text-red-700 transition font-bold text-sm bg-red-50 px-3 py-1.5 rounded-full">
                                    <LogOut className="w-4 h-4" /> Logout
                                </button>
                            </>
                        ) : (
                            <button onClick={() => router.push('/login')} className="bg-[#D4AF37] text-white flex items-center gap-1 font-bold text-sm px-4 py-2 rounded-full hover:bg-[#c29e2f] transition">
                                <User className="w-4 h-4" /> Login / Register
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu Button + Bell */}
                    <div className="md:hidden flex items-center gap-1">
                        {user && (
                            <button
                                onClick={() => router.push('/?tab=notifications')}
                                className="relative p-2 text-[#881337]"
                            >
                                <Bell className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
                                )}
                            </button>
                        )}
                        <button onClick={() => setIsOpen(!isOpen)} className="text-[#881337] focus:outline-none p-2">
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown with animation */}
            {isOpen && (
                <div className="md:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-100 shadow-lg px-4 pt-2 pb-6 space-y-2 rounded-b-3xl animate-in slide-in-from-top-2 duration-200">
                    {user ? (
                        <>
                            <button onClick={() => router.push('/')} className={`w-full text-left flex items-center gap-3 font-semibold text-lg p-3 rounded-xl transition-colors ${isActive('/') ? 'text-[#881337] bg-rose-50' : 'text-gray-800 hover:text-[#881337] hover:bg-gray-50'}`}>
                                <Home className="w-5 h-5 text-[#D4AF37]" /> Dashboard
                            </button>
                            <button onClick={() => router.push('/candidate-registration')} className={`w-full text-left flex items-center gap-3 font-semibold text-lg p-3 rounded-xl transition-colors ${isActive('/candidate-registration') ? 'text-[#881337] bg-rose-50' : 'text-gray-800 hover:text-[#881337] hover:bg-gray-50'}`}>
                                <User className="w-5 h-5 text-[#D4AF37]" /> Edit Biodata
                            </button>
                            <button onClick={handleLogout} className="w-full text-left text-red-600 flex items-center gap-3 font-bold text-lg p-3 bg-red-50 rounded-xl mt-2">
                                <LogOut className="w-5 h-5" /> Logout
                            </button>
                        </>
                    ) : (
                        <button onClick={() => router.push('/login')} className="w-full text-center bg-[#D4AF37] text-white font-bold text-lg p-3 rounded-xl">
                            Login / Register
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
