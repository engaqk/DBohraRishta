"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

export default function AdminLogin() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Step 1: Validate credentials server-side and get a Firebase custom token
            const res = await fetch('/api/admin/get-auth-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (!res.ok || data.error) {
                toast.error("Invalid admin credentials");
                return;
            }

            // Step 2a: If admin SDK is configured — sign in with the custom Firebase token.
            // This gives the admin a real, INDEPENDENT Firebase session regardless of any
            // regular user being logged in.
            if (data.customToken) {
                try {
                    await signInWithCustomToken(auth, data.customToken);
                } catch (firebaseErr) {
                    console.warn("Custom token sign-in failed, continuing with localStorage-only session:", firebaseErr);
                    // Still grant access — Firestore will be accessed via API routes
                }
            }

            // Step 2b: Set the admin session token (always set regardless of Firebase sign-in)
            localStorage.setItem("admin_auth_token", "secure_admin_session_active");
            toast.success("Admin access granted.");
            router.push('/admin/approvals');

        } catch (err) {
            console.error("Admin login error:", err);
            toast.error("Login failed. Please try again.");
        } finally {
            setLoading(false);
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
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#881337] text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-rose-900 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                        {loading ? "Signing in..." : "Secure Login"}
                    </button>
                </form>
            </div>
        </div>
    );
}
