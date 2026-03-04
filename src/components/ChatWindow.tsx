"use client";
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, addDoc, onSnapshot, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Send, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ChatWindowProps {
    connectionId: string; // The requestId acts as the chat room
    otherUserName: string;
    onClose: () => void;
}

interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    timestamp: any;
}

export default function ChatWindow({ connectionId, otherUserName, onClose }: ChatWindowProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "rishta_requests", connectionId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: ChatMessage[] = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() } as ChatMessage);
            });
            setMessages(msgs);
            setLoading(false);
            // Auto scroll to bottom
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [connectionId, user]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        const text = newMessage;
        setNewMessage("");

        await addDoc(collection(db, "rishta_requests", connectionId, "messages"), {
            text,
            senderId: user.uid,
            timestamp: serverTimestamp()
        });
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-3xl shadow-lg border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-[#881337] text-white p-4 flex items-center gap-3">
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-rose-100 text-[#881337] rounded-full flex items-center justify-center font-bold text-lg">
                    {otherUserName.charAt(0)}
                </div>
                <div>
                    <h3 className="font-bold">{otherUserName}</h3>
                    <p className="text-xs text-rose-200">Private & Secure</p>
                </div>
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
                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    return (
                        <div key={msg.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm relative z-10 ${isMe ? 'bg-[#881337] text-white self-end rounded-br-sm' : 'bg-white border border-rose-100 text-gray-900 self-start rounded-bl-sm'}`}>
                            {msg.text}
                        </div>
                    );
                })}
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
                <form onSubmit={handleSendMessage} className="p-3 flex gap-2 items-center">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#881337] focus:border-transparent transition-shadow"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-[#D4AF37] text-white rounded-full hover:bg-[#c29e2f] shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed">
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
