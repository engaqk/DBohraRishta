"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Heart, Star, Share2, Lock } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Story {
    id: string;
    fromName: string;
    toName: string;
    fromJamaat?: string;
    toJamaat?: string;
    fromCity?: string;
    toCity?: string;
    acceptedAt?: any;
    shareStory?: boolean;
    message?: string;
}

export default function SuccessStoriesPage() {
    const { user } = useAuth();
    const [stories, setStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState(true);
    const [myRequest, setMyRequest] = useState<any>(null);
    const [optingIn, setOptingIn] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetch = async () => {
            // Fetch all accepted requests that opted into sharing
            const q = query(collection(db, 'rishta_requests'), where('status', '==', 'accepted'), where('shareStory', '==', true));
            const snap = await getDocs(q);
            const list: Story[] = [];
            for (const d of snap.docs) {
                const data = d.data();
                const [fromDoc, toDoc] = await Promise.all([
                    getDoc(doc(db, 'users', data.from)),
                    getDoc(doc(db, 'users', data.to)),
                ]);
                const from = fromDoc.data() || {};
                const to = toDoc.data() || {};
                list.push({
                    id: d.id,
                    fromName: from.name?.split(' ')[0] || 'Member',
                    toName: to.name?.split(' ')[0] || 'Member',
                    fromJamaat: from.jamaat,
                    toJamaat: to.jamaat,
                    fromCity: from.city || from.hizratLocation,
                    toCity: to.city || to.hizratLocation,
                    acceptedAt: data.acceptedAt,
                    message: data.storyMessage,
                });
            }
            setStories(list);
            setLoading(false);
        };
        fetch();
    }, []);

    useEffect(() => {
        // Check if current user has an accepted request
        if (!user) return;
        const checkMyReq = async () => {
            const q1 = query(collection(db, 'rishta_requests'), where('from', '==', user.uid), where('status', '==', 'accepted'));
            const q2 = query(collection(db, 'rishta_requests'), where('to', '==', user.uid), where('status', '==', 'accepted'));
            const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
            const found = [...s1.docs, ...s2.docs][0];
            if (found) setMyRequest({ id: found.id, ...found.data() });
        };
        checkMyReq();
    }, [user]);

    const handleOptIn = async () => {
        if (!myRequest) return;
        setOptingIn(true);
        try {
            await updateDoc(doc(db, 'rishta_requests', myRequest.id), {
                shareStory: true,
                storyMessage: message || null,
            });
            toast.success('Your story has been shared! JazakAllah Khair 💚');
            setMyRequest({ ...myRequest, shareStory: true });
        } catch {
            toast.error('Could not share story');
        } finally {
            setOptingIn(false);
        }
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({ title: 'DBohraRishta Success Stories', url: window.location.href });
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied!');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white">
            {/* Hero */}
            <div className="bg-gradient-to-br from-[#881337] to-[#9F1239] text-white py-16 px-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <span key={i} className="absolute text-4xl" style={{ top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, opacity: 0.3 }}>💐</span>
                    ))}
                </div>
                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="flex justify-center mb-4">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-4">
                            <Heart className="w-10 h-10 text-[#D4AF37] fill-current" />
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black font-serif mb-3">Success Stories 💕</h1>
                    <p className="text-white/80 text-sm leading-relaxed max-w-md mx-auto">
                        Alhamdulillah — beautiful connections formed through DBohraRishta. May Allah bless every union.
                    </p>
                    <button onClick={handleShare}
                        className="mt-5 flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white px-5 py-2 rounded-full text-sm font-bold transition-all mx-auto">
                        <Share2 className="w-4 h-4" /> Share This Page
                    </button>
                </div>
            </div>

            <main className="max-w-4xl mx-auto px-4 py-10">
                {/* Opt-in for current user */}
                {myRequest && !myRequest.shareStory && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 mb-10 shadow-sm">
                        <div className="flex items-start gap-4">
                            <div className="bg-emerald-100 rounded-full p-3">
                                <Star className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="font-black text-emerald-800 text-lg mb-1">Alhamdulillah — You have an accepted connection! 🎉</h2>
                                <p className="text-emerald-700 text-sm mb-4">Would you like to share your story on this wall? Only first names and city will be shown — no photos or contact details.</p>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Optional: Share a short message (e.g. 'JazakAllah to the platform team...')"
                                    className="w-full text-sm border border-emerald-200 bg-white rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-3"
                                    rows={3}
                                />
                                <div className="flex items-center gap-2">
                                    <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <p className="text-xs text-emerald-600">Only first names + cities shown. Fully anonymous otherwise.</p>
                                </div>
                                <button onClick={handleOptIn} disabled={optingIn}
                                    className="mt-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md">
                                    {optingIn ? 'Sharing…' : '✨ Share My Story'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats banner */}
                <div className="flex justify-center gap-8 mb-10 text-center">
                    <div>
                        <p className="text-3xl font-black text-[#881337]">{stories.length}</p>
                        <p className="text-xs text-gray-500 font-bold uppercase">Stories Shared</p>
                    </div>
                    <div className="w-px bg-gray-200" />
                    <div>
                        <p className="text-3xl font-black text-[#D4AF37]">100%</p>
                        <p className="text-xs text-gray-500 font-bold uppercase">Bohra Community</p>
                    </div>
                    <div className="w-px bg-gray-200" />
                    <div>
                        <p className="text-3xl font-black text-emerald-600">ITS</p>
                        <p className="text-xs text-gray-500 font-bold uppercase">Verified Matches</p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : stories.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">💌</div>
                        <p className="text-gray-500 font-bold">Be the first to share your story!</p>
                        <p className="text-gray-400 text-sm mt-1">Once connections are accepted and couples opt-in, their stories appear here.</p>
                        <Link href="/" className="mt-5 inline-flex items-center gap-2 bg-[#881337] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow hover:bg-[#9F1239] transition-all">
                            <Heart className="w-4 h-4" /> Find Your Match
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {stories.map((s, i) => (
                            <div key={s.id}
                                className="bg-white rounded-2xl shadow-sm border border-rose-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                                {/* Decorative background */}
                                <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-24 h-24 bg-rose-50 rounded-full" />
                                <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[#D4AF37]/10 rounded-full" />

                                <div className="relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center font-black text-[#881337]">
                                            {s.fromName[0]}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Heart className="w-5 h-5 text-[#881337] fill-current animate-pulse" />
                                        </div>
                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center font-black text-[#881337]">
                                            {s.toName[0]}
                                        </div>
                                        <div className="ml-1">
                                            <p className="font-black text-[#881337] text-base">{s.fromName} & {s.toName}</p>
                                            {(s.fromCity || s.toCity) && (
                                                <p className="text-xs text-gray-400 font-medium">
                                                    {s.fromCity || '—'} & {s.toCity || '—'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {s.message && (
                                        <blockquote className="text-sm text-gray-600 italic border-l-2 border-[#D4AF37] pl-3 leading-relaxed">
                                            "{s.message}"
                                        </blockquote>
                                    )}

                                    <div className="flex items-center gap-2 mt-4">
                                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100">
                                            ✓ Verified Match #{i + 1}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CTA */}
                <div className="mt-16 text-center bg-gradient-to-r from-[#881337] to-[#9F1239] rounded-3xl p-8 text-white">
                    <h2 className="font-black text-2xl font-serif mb-2">Ready to find your match?</h2>
                    <p className="text-white/75 text-sm mb-5">Join thousands of Bohra families on a trusted platform.</p>
                    <Link href="/" className="bg-[#D4AF37] text-white font-black px-8 py-3 rounded-xl hover:bg-[#c29e2f] transition-all shadow-lg">
                        💌 Browse Profiles
                    </Link>
                </div>
            </main>
        </div>
    );
}
