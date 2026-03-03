"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, Home, User, LogOut } from 'lucide-react';

export default function GlobalNav() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

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
                    <div className="hidden md:flex items-center space-x-6">
                        {user ? (
                            <>
                                <button onClick={() => router.push('/')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/') ? 'text-[#881337] bg-rose-50 font-bold' : 'text-gray-600 hover:text-[#881337] hover:bg-gray-50'}`}>
                                    <Home className="w-4 h-4" /> Dashboard
                                </button>
                                <button onClick={() => router.push('/candidate-registration')} className={`flex items-center gap-1.5 transition font-medium text-sm px-3 py-1.5 rounded-lg ${isActive('/candidate-registration') ? 'text-[#881337] bg-rose-50 font-bold' : 'text-gray-600 hover:text-[#881337] hover:bg-gray-50'}`}>
                                    <User className="w-4 h-4" /> My Profile
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

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center">
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
                                <User className="w-5 h-5 text-[#D4AF37]" /> Edit Profile
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
