"use client";

import React, { useState, useEffect } from "react";
import { ShieldAlert, Clock, Search, FileText, User, MessageCircle, CheckCircle } from "lucide-react";

interface AuditLog {
    id: string;
    adminId: string;
    action: 'status_change' | 'send_message' | 'broadcast';
    targetUserId?: string;
    targetUserName?: string;
    newStatus?: string;
    message?: string;
    timestamp: any;
}

export default function AuditLogsTab() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [visibleCount, setVisibleCount] = useState(50);

    useEffect(() => {
        const fetchLogs = async () => {
            if (logs.length === 0) setLoading(true);
            try {
                const token = localStorage.getItem('admin_auth_token');
                const res = await fetch('/api/admin/audit-logs', {
                    headers: { 'Authorization': token || '' }
                });
                const data = await res.json();
                if (data.logs) {
                    setLogs(data.logs);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, [logs.length]);

    useEffect(() => {
        setVisibleCount(50);
    }, [searchQuery]);

    const filteredLogs = logs.filter(l =>
        !searchQuery ||
        l.targetUserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.action?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getActionIcon = (action: string) => {
        if (action === 'status_change') return <CheckCircle className="w-4 h-4 text-emerald-500" />;
        if (action === 'send_message') return <MessageCircle className="w-4 h-4 text-blue-500" />;
        return <FileText className="w-4 h-4 text-gray-500" />;
    };

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-3xl flex items-center justify-between">
                <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 bg-gray-800 text-white rounded-2xl flex items-center justify-center shadow-lg">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-gray-900 font-black text-xl">Admin Audit Logs</h3>
                        <p className="text-gray-500 text-sm font-medium">Tracking all administrative actions for transparency.</p>
                    </div>
                </div>
                <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter logs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#881337] transition-all"
                    />
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Time</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Action</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Target User</th>
                                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading && logs.length === 0 ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full"></div></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center text-gray-400 italic">No logs found matching your criteria.</td>
                                </tr>
                            ) : (
                                <>
                                    {filteredLogs.slice(0, visibleCount).map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-3.5 h-3.5 text-gray-300" />
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    {getActionIcon(log.action)}
                                                    <span className="text-xs font-black uppercase tracking-tight text-[#881337]">
                                                        {log.action.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-700">{log.targetUserName || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-xs text-gray-500 line-clamp-1 max-w-md">
                                                    {log.newStatus ? `Moved to ${log.newStatus}. ` : ''}
                                                    {log.message || ''}
                                                </p>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredLogs.length > visibleCount && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8">
                                                <div className="flex justify-center">
                                                    <button 
                                                        onClick={() => setVisibleCount(prev => prev + 100)}
                                                        className="bg-white border border-gray-200 px-8 py-2.5 rounded-xl text-[11px] font-black text-[#881337] shadow-sm hover:shadow-md transition-all uppercase tracking-widest"
                                                    >
                                                        Load More Logs
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
