"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, addDoc, onSnapshot, orderBy, serverTimestamp, doc, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Send, ArrowLeft, Loader2, Phone, Mic, Square, Trash2, Play, Pause, User, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ChatWindowProps {
    connectionId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserImageUrl?: string;
    onClose: () => void;
    onStartCall?: () => void;
}

interface ChatMessage {
    id: string;
    text?: string;
    audioUrl?: string;
    type?: 'text' | 'audio';
    senderId: string;
    timestamp: any;
}

export default function ChatWindow({ connectionId, otherUserId, otherUserName, otherUserImageUrl, onClose, onStartCall }: ChatWindowProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [otherUserStatus, setOtherUserStatus] = useState<{ isOnline: boolean; lastActive: any } | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Helpers for Date Formatting
    const formatMessageTime = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const groupMessagesByDate = (msgs: ChatMessage[]) => {
        const groups: { dateLabel: string, messages: ChatMessage[] }[] = [];
        let currentDateLabel = '';

        msgs.forEach(msg => {
            if (!msg.timestamp) return;
            const date = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);

            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            let dateString = '';
            if (date.toDateString() === today.toDateString()) {
                dateString = 'Today';
            } else if (date.toDateString() === yesterday.toDateString()) {
                dateString = 'Yesterday';
            } else {
                dateString = date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
            }

            if (dateString !== currentDateLabel) {
                currentDateLabel = dateString;
                groups.push({ dateLabel: currentDateLabel, messages: [msg] });
            } else {
                groups[groups.length - 1].messages.push(msg);
            }
        });
        return groups;
    };

    // --- OTHER USER STATUS LISTENER ---
    useEffect(() => {
        if (!otherUserId) return;
        const unsub = onSnapshot(doc(db, 'users', otherUserId), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setOtherUserStatus({ 
                    isOnline: data.isOnline || false, 
                    lastActive: data.lastActive 
                });
            }
        });
        return () => unsub();
    }, [otherUserId]);

    const formatLastSeen = () => {
        if (!otherUserStatus) return 'Offline';
        if (otherUserStatus.isOnline) return 'Online';
        if (!otherUserStatus.lastActive) return 'Offline';
        
        try {
            const lastActive = otherUserStatus.lastActive?.toDate 
                ? otherUserStatus.lastActive.toDate() 
                : new Date(otherUserStatus.lastActive);
            
            const diff = Date.now() - lastActive.getTime();
            if (isNaN(diff)) return 'Offline';
            const mins = Math.floor(diff / 60000);
            
            if (mins < 1) return 'Active just now';
            if (mins < 60) return `${mins}m ago`;
            if (mins < 1440) return `${Math.floor(mins/60)}h ago`;
            return lastActive.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } catch (e) {
            return 'Recently';
        }
    };

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, `rishta_requests/${connectionId}/messages`),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
            });
            setMessages(msgs.reverse());
            setLoading(false);
            // Auto scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [connectionId, user]);

    const BAD_WORDS = ['porn', 'sex', 'nude', 'nudes', 'fuck', 'shit', 'bitch', 'ass', 'dick', 'pussy', 'slut', 'whore', 'boobs', 'tits', 'cock', 'cunt'];
    const [msgError, setMsgError] = useState("");

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsgError("");
        if (!newMessage.trim() || !user) return;

        // Basic profanity filter
        const lowerMsg = newMessage.toLowerCase();
        const hasBadWords = BAD_WORDS.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(lowerMsg);
        });

        if (hasBadWords) {
            setMsgError("Message blocked. Please maintain respectful, halal communication.");
            return;
        }

        const text = newMessage;
        setNewMessage("");

        await addDoc(collection(db, `rishta_requests/${connectionId}/messages`), {
            text,
            type: 'text',
            senderId: user.uid,
            timestamp: serverTimestamp()
        });

        // 🔔 Dispatch Real-Time Web & App Push Notification to recipient
        fetch('/api/notify/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                targetUserId: otherUserId,
                title: `💬 New Message from ${user.displayName || 'Candidate'}`,
                body: text.length > 80 ? text.slice(0, 80) + '...' : text,
                url: `/?tab=messages&directChat=${user.uid}`
            })
        }).catch(err => console.warn('Push dispatch notice:', err));
    };

    // --- VOICE RECORDING LOGIC ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                if (audioBlob.size > 1000) { // Min size check
                    await uploadVoiceNote(audioBlob);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setRecordingTime(0);
            timerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Recording error:", err);
            setMsgError("Microphone access denied. Please enable mic.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            setIsRecording(false);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    };

    const uploadVoiceNote = async (blob: Blob) => {
        if (!user) return;
        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                await addDoc(collection(db, `rishta_requests/${connectionId}/messages`), {
                    audioUrl: base64Audio,
                    type: 'audio',
                    senderId: user.uid,
                    timestamp: serverTimestamp()
                });
            };
        } catch (error) {
            console.error("Voice encoding error:", error);
            setMsgError("Failed to encode voice note.");
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-[#881337] text-white p-3 sm:p-4 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <button 
                        onClick={onClose} 
                        className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all shrink-0"
                        title="Back to messages list"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    
                    {/* Candidate Info - Clickable to open full profile */}
                    <div 
                        onClick={() => router.push(`/profile?id=${otherUserId}&from=chat`)}
                        className="flex items-center gap-2.5 cursor-pointer group/user p-1 -m-1 rounded-2xl hover:bg-white/15 transition-all min-w-0 flex-1"
                        title={`View ${otherUserName}'s full biodata and photos`}
                    >
                        <div className="relative shrink-0">
                            <div className="w-10 h-10 bg-rose-100 text-[#881337] rounded-full flex items-center justify-center font-bold text-lg overflow-hidden border-2 border-white/80 shadow-sm group-hover/user:scale-105 transition-transform">
                                {otherUserImageUrl ? (
                                    <img src={otherUserImageUrl} alt={otherUserName} className="w-full h-full object-cover" />
                                ) : (
                                    otherUserName.charAt(0)
                                )}
                            </div>
                            {otherUserStatus?.isOnline && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#881337] rounded-full shadow-xs animate-pulse" />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-1.5">
                                <h3 className="font-bold leading-tight truncate group-hover/user:underline text-sm sm:text-base">
                                    {otherUserName}
                                </h3>
                                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-rose-100 group-hover/user:bg-[#D4AF37] group-hover/user:text-rose-950 font-bold transition-colors shrink-0">
                                    Profile ↗
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 leading-none mt-0.5">
                                <p className="text-[10px] text-rose-200 font-medium truncate">
                                    {formatLastSeen()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => router.push(`/profile?id=${otherUserId}&from=chat`)}
                        className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all border border-white/20 shadow-xs"
                        title="View candidate's full biodata and photos"
                    >
                        <User className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">View Profile</span>
                    </button>
                    {onStartCall && (
                        <button 
                            onClick={onStartCall}
                            className="p-2.5 sm:p-3 bg-[#D4AF37] hover:bg-[#c29e2f] active:scale-95 text-rose-950 rounded-xl transition-all shadow-md border border-white/20"
                            title="Start Secure VoIP Call"
                        >
                            <Phone className="w-4 h-4 fill-rose-950" />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Profile Access Bar */}
            <div 
                onClick={() => router.push(`/profile?id=${otherUserId}&from=chat`)}
                className="bg-gradient-to-r from-rose-50 via-white to-amber-50 border-b border-rose-100 px-4 py-1.5 text-xs text-[#881337] flex items-center justify-between cursor-pointer hover:bg-rose-100/50 transition-colors group/bar"
                title="Click to view full biodata, family background, and photos"
            >
                <div className="flex items-center gap-2 truncate">
                    <span className="text-sm">📋</span>
                    <span className="font-semibold text-gray-700 truncate text-[11px] sm:text-xs">
                        Viewing conversation with <strong>{otherUserName}</strong>
                    </span>
                </div>
                <span className="text-[#881337] font-black text-[10px] sm:text-[11px] group-hover/bar:underline shrink-0 flex items-center gap-0.5 ml-2">
                    Open Full Biodata & Photos <span>→</span>
                </span>
            </div>

            {/* Adab & Decency Protection Banner */}
            <div className="bg-amber-50/90 border-b border-amber-200/60 px-4 py-2 text-[11px] text-amber-900 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                    <span className="text-amber-600">🛡️</span>
                    <span className="font-medium">
                        <strong>Islamic Adab:</strong> Communicate with noble intentions, mutual respect, and dignity.
                    </span>
                </div>
                <span className="text-[10px] text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold shrink-0">
                    Protected Chat
                </span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-4 overflow-y-auto bg-rose-50 flex flex-col gap-3 relative" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 46.223l-3.344-3.042C14.735 32.378 7 25.378 7 16.711 7 9.544 12.544 4 19.711 4c4.056 0 7.944 1.889 10.289 4.889C32.344 5.889 36.233 4 40.289 4 47.456 4 53 9.544 53 16.711c0 8.667-7.735 15.667-19.656 26.47L30 46.223z' fill='%23881337' fill-opacity='0.05' fill-rule='evenodd'/%3E%3C/svg%3E\")" }}>
                {loading && (
                    <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-[#881337]" />
                    </div>
                )}
                {!loading && messages.length === 0 && (
                    <div className="text-center text-gray-400 text-sm p-4 mt-auto mb-auto">
                        Alhamdulillah! Start the conversation.
                    </div>
                )}
                {groupMessagesByDate(messages).map((group, groupIndex) => (
                    <div key={groupIndex} className="flex flex-col gap-3">
                        <div className="flex justify-center my-2">
                            <span className="bg-gray-200/80 text-gray-700 text-[11px] font-bold px-3 py-1 rounded-lg backdrop-blur-sm shadow-sm uppercase tracking-wide">
                                {group.dateLabel}
                            </span>
                        </div>
                        {group.messages.map((msg) => {
                            const isMe = msg.senderId === user?.uid;
                            return (
                                <div key={msg.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] shadow-sm relative z-10 flex flex-col gap-1 ${isMe ? 'bg-[#dcf8c6] text-gray-900 self-end rounded-br-sm' : 'bg-white border border-rose-100 text-gray-900 self-start rounded-bl-sm'}`}>
                                    {msg.type === 'audio' ? (
                                        <div className="flex items-center gap-3 py-1 min-w-[200px]">
                                            <audio src={msg.audioUrl} controls className="h-8 max-w-[180px] accent-[#881337]" />
                                        </div>
                                    ) : (
                                        <span style={{ wordBreak: 'break-word' }} className="pr-6">{msg.text}</span>
                                    )}
                                    <span className={`text-[10px] self-end mt-[-4px] mb-[-2px] ${isMe ? 'text-green-800/60' : 'text-gray-400'}`}>
                                        {formatMessageTime(msg.timestamp)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Emojis & Input Form */}
            <div className="bg-white border-t border-rose-100 flex flex-col">
                <div className="flex gap-2 p-2 px-3 overflow-x-auto scrollbar-hide border-b border-gray-50 bg-rose-50/30">
                    {["❤️", "🤲", "😊", "✨", "MashaAllah", "InshaAllah", "JazakAllah"].map(emoji => (
                        <button
                            key={emoji}
                            onClick={() => setNewMessage(prev => prev + (prev ? " " : "") + emoji)}
                            className="text-sm bg-white border border-rose-100 px-3 py-1 rounded-full shadow-sm hover:bg-rose-50 text-[#881337] font-medium whitespace-nowrap transition-colors active:scale-95"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
                {msgError && (
                    <div className="px-3 pt-2 text-xs font-bold text-red-500 animate-pulse text-center bg-red-50 py-1">
                        {msgError}
                    </div>
                )}
                <form onSubmit={handleSendMessage} className="p-3 flex gap-2 items-center">
                    {isRecording ? (
                        <div className="flex-1 bg-rose-50 border border-rose-200 rounded-full px-4 py-2.5 flex items-center justify-between animate-pulse">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                <span className="text-sm font-bold text-red-600">Recording {formatTime(recordingTime)}</span>
                            </div>
                            <button 
                                type="button"
                                onMouseUp={stopRecording}
                                onTouchEnd={stopRecording}
                                className="text-rose-800 text-xs font-black uppercase tracking-widest"
                            >
                                Release to Send
                            </button>
                        </div>
                    ) : (
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#881337] focus:border-transparent transition-shadow"
                        />
                    )}
                    
                    {!newMessage.trim() && !isRecording ? (
                        <button 
                            type="button" 
                            onMouseDown={startRecording}
                            onTouchStart={startRecording}
                            className="p-3 bg-rose-100 text-[#881337] rounded-full hover:bg-rose-200 shadow-sm transition-all active:scale-90"
                            title="Hold to Record Voice Note"
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    ) : (
                        <button type="submit" disabled={!newMessage.trim() && !isRecording} className="p-3 bg-[#D4AF37] text-white rounded-full hover:bg-[#c29e2f] shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed">
                            <Send className="w-4 h-4" />
                        </button>
                    )}
                </form>
            </div>
        </div>
    );
}
