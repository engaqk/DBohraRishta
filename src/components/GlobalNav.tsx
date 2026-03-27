"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Home, User, LogOut, Bell, HelpCircle, Smartphone, ShieldCheck, Users, ShieldAlert } from 'lucide-react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export default function GlobalNav() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Listen for notifications
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            where('isRead', '==', false)
        );

        const unsub = onSnapshot(q, (snap) => {
            setUnreadCount(snap.size);
        });

        return () => unsub();
    }, [user]);

    const isActive = (path: string) => pathname === path;
    const isNotificationsActive = pathname === '/' && new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') === 'notifications';
    const isAdminPage = pathname?.startsWith('/admin');

    // Body scroll lock
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Close on path change
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // Don't show nav on login or onboarding
    if (pathname === '/login' || pathname === '/onboarding') return null;

    const navClasses = isAdminPage 
        ? "fixed top-0 left-0 w-full z-[100] bg-[#881337] text-white border-b border-rose-900 shadow-lg"
        : "fixed top-0 left-0 w-full z-[100] bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm print:hidden";

    const handleLogout = async () => {
        setIsOpen(false);
        const redirectPath = isAdminPage ? '/admin/login' : '/login';
        await logout();
        router.push(redirectPath);
    };

    return (
        <>
            {/* Spacer handled by RootLayout pt-16 */}
            <div id="global-navigation-bar" className={navClasses}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div
                            className="flex items-center gap-2 cursor-pointer group"
                            onClick={() => router.push(isAdminPage ? '/admin/approvals' : '/')}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-110 ${isAdminPage ? 'bg-white text-[#881337]' : 'bg-gradient-to-br from-white to-rose-100 text-[#D4AF37] border-2 border-[#D4AF37]'}`}>
                                53
                            </div>
                            <span className={`font-serif font-bold tracking-tight text-lg ${isAdminPage ? 'text-white' : 'text-[#881337]'}`}>
                                DBohra<span className={isAdminPage ? "font-normal opacity-80" : "font-light italic"}>{isAdminPage ? "Admin" : "Rishta"}</span>
                            </span>
                        </div>

                        {/* Desktop Bell + Help */}
                        <div className="hidden md:flex items-center gap-1">
                            {user && (
                                <>
                                    <button
                                        onClick={() => router.push('/?tab=notifications')}
                                        className={`relative p-2 transition-all duration-300 rounded-xl ${isNotificationsActive ? 'text-white bg-[#881337] shadow-md ring-2 ring-rose-100' : 'text-gray-500 hover:text-[#881337] hover:bg-rose-50'}`}
                                        title="Notifications"
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 text-[9px] font-black flex items-center justify-center rounded-full border-2 ${isNotificationsActive ? 'bg-[#D4AF37] text-[#881337] border-[#881337]' : 'bg-red-500 text-white border-white'}`}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => router.push('/?adminChat=open')}
                                        className="p-2 text-gray-500 hover:text-[#881337] hover:bg-rose-50 transition-all rounded-xl"
                                        title="Help & Chat with Admin"
                                    >
                                        <HelpCircle className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => window.dispatchEvent(new CustomEvent('trigger-pwa-install'))}
                                        className="p-2 text-[#D4AF37] hover:text-[#881337] hover:bg-rose-50 transition-all rounded-xl"
                                        title="Install Mobile App"
                                    >
                                        <Smartphone className="w-5 h-5" />
                                    </button>
                                </>
                            )}
                            {user ? (
                                <>
                                    {!isAdminPage && (
                                        <>
                                            <button onClick={() => router.push('/')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/') ? 'text-[#881337] bg-rose-50' : 'hover:bg-black/5'} font-bold`}>
                                                <Home className="w-4 h-4" /> Dashboard
                                            </button>
                                            <button onClick={() => router.push('/candidate-registration')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/candidate-registration') ? 'text-[#881337] bg-rose-50' : 'hover:bg-black/5'} font-bold`}>
                                                <User className="w-4 h-4" /> My Biodata
                                            </button>
                                        </>
                                    )}
                                    <button onClick={handleLogout} className="text-red-600 flex items-center gap-1 hover:text-red-700 transition font-bold text-sm bg-red-50 px-3 py-1.5 rounded-full ml-2">
                                        <LogOut className="w-4 h-4" /> Logout
                                    </button>
                                </>
                            ) : (
                                <button onClick={() => router.push('/login')} className="bg-[#D4AF37] text-white flex items-center gap-1 font-bold text-sm px-4 py-2 rounded-full hover:bg-[#c29e2f] transition">
                                    <User className="w-4 h-4" /> Login / Register
                                </button>
                            )}
                        </div>

                        {/* Mobile Controls */}
                        <div className="md:hidden flex items-center gap-1">
                            {!isAdminPage && user && (
                                <>
                                    <button
                                        onClick={() => router.push('/?tab=notifications')}
                                        className={`relative p-2 transition-all rounded-xl ${isNotificationsActive ? 'text-white bg-[#881337] shadow-lg' : 'text-[#881337]'}`}
                                    >
                                        <Bell className="w-5 h-5" />
                                        {unreadCount > 0 && (
                                            <span className={`absolute -top-1 -right-1 w-4 h-4 text-[9px] font-black flex items-center justify-center rounded-full border-2 animate-pulse ${isNotificationsActive ? 'bg-[#D4AF37] text-[#881337] border-[#881337]' : 'bg-red-500 text-white border-white'}`}>
                                                {unreadCount}
                                            </span>
                                        )}
                                    </button>
                                </>
                            )}
                            <button 
                                onClick={(e) => {
                                    e.preventDefault();
                                    setIsOpen(!isOpen);
                                }} 
                                className={`p-2 active:scale-95 transition-transform ${isAdminPage ? 'text-white' : 'text-[#881337]'}`}
                            >
                                {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsOpen(false)}>
                    <div 
                        className={`absolute top-16 left-0 w-full shadow-2xl px-4 pt-2 pb-8 space-y-2 rounded-b-[2.5rem] transform transition-transform animate-in slide-in-from-top-4 duration-300 ${isAdminPage ? 'bg-[#881337] text-white border-b border-white/10' : 'bg-white text-gray-800'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        {isAdminPage ? (
                            <>
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-50 px-3 py-2">Administration</p>
                                <button onClick={() => router.push('/admin/approvals')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/admin/approvals') ? 'bg-white/20' : ''}`}>
                                    <ShieldCheck className="w-5 h-5" /> Verification Queue
                                </button>
                                <button onClick={() => router.push('/admin/users')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/admin/users') ? 'bg-white/20' : ''}`}>
                                    <Users className="w-5 h-5" /> User Directory
                                </button>
                                <button onClick={() => router.push('/admin/broadcast')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/admin/broadcast') ? 'bg-white/20' : ''}`}>
                                    <Bell className="w-5 h-5" /> Notification Hub
                                </button>
                                <button onClick={() => router.push('/admin/sms-broadcast')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/admin/sms-broadcast') ? 'bg-white/20' : ''}`}>
                                    <Smartphone className="w-5 h-5" /> SMS Gateway
                                </button>
                                <button onClick={() => router.push('/admin/audit-logs')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/admin/audit-logs') ? 'bg-white/20' : ''}`}>
                                    <ShieldAlert className="w-5 h-5" /> Audit Logs
                                </button>
                                <div className="h-px bg-white/10 my-2" />
                                <button onClick={() => router.push('/')} className="w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl bg-white/10">
                                    <Home className="w-5 h-5" /> Public Dashboard
                                </button>
                            </>
                        ) : user ? (
                            <>
                                <button onClick={() => router.push('/')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/') ? 'text-[#881337] bg-rose-50' : ''}`}>
                                    <Home className="w-5 h-5 text-[#D4AF37]" /> Dashboard
                                </button>
                                <button onClick={() => router.push('/candidate-registration')} className={`w-full text-left flex items-center gap-3 font-bold text-lg p-3 rounded-2xl ${isActive('/candidate-registration') ? 'text-[#881337] bg-rose-50' : ''}`}>
                                    <User className="w-5 h-5 text-[#D4AF37]" /> Edit Biodata
                                </button>
                                <button onClick={handleLogout} className="w-full text-left text-red-600 flex items-center gap-3 font-black text-lg p-3 bg-red-50 rounded-2xl mt-4">
                                    <LogOut className="w-5 h-5" /> Logout
                                </button>
                            </>
                        ) : (
                            <button onClick={() => router.push('/login')} className="w-full text-center bg-[#D4AF37] text-white font-black text-lg p-4 rounded-2xl">
                                Login / Register
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
