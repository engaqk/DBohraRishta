"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === "admin" && password === "admin53") {
            // Set a secure local cookie or session flag for admin
            localStorage.setItem("admin_auth_token", "secure_admin_session_active");
            toast.success("Admin access granted.");
            router.push('/admin/approvals');
        } else {
            toast.error("Invalid admin credentials");
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-[#881337]">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-md w-full animate-in zoom-in-95 duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-rose-50 text-[#881337] rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold font-serif">Admin Portal Login</h1>
                    <p className="text-sm text-gray-500 mt-1">Authorized personnel only</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder="e.g. admin"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]"
                        />
                    </div>
                    <button type="submit" className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-rose-900 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <LogIn className="w-5 h-5" /> Secure Login
                    </button>
                </form>
            </div>
        </div>
    );
}
