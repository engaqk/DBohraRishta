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
            <div className="flex-1 p-4 overflow-y-auto bg-[#F9FAFB] flex flex-col gap-3">
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
                        <div key={msg.id} className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-[#881337] text-white self-end rounded-br-sm' : 'bg-gray-200 text-gray-900 self-start rounded-bl-sm'}`}>
                            {msg.text}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#881337]"
                />
                <button type="submit" disabled={!newMessage.trim()} className="p-3 bg-[#D4AF37] text-white rounded-full hover:bg-[#c29e2f] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    );
}
