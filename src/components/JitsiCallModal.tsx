"use client";
import React, { useEffect, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { X, Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2, Minimize2 } from 'lucide-react';

interface VoIPCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    otherUserName: string;
    roomName: string;
    userName: string;
    userEmail?: string;
    isAudioOnly?: boolean;
}

export default function VoIPCallModal({ isOpen, onClose, otherUserName, roomName, userName, userEmail = "", isAudioOnly = true }: VoIPCallModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);

    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[1000] flex items-center justify-center p-0 md:p-4 bg-black/95 backdrop-blur-xl transition-all duration-500`}>
            <div className={`relative bg-gray-900 shadow-2xl overflow-hidden transition-all duration-500
                ${isMaximized ? 'w-full h-full rounded-0' : 'w-full max-w-4xl h-[80vh] rounded-3xl border border-white/10'}`}>
                
                {/* Custom Header Overlay */}
                <div className="absolute top-0 left-0 right-0 z-[1001] p-4 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-center pointer-events-none">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#881337] rounded-full flex items-center justify-center text-white font-bold border border-white/20">
                            {otherUserName.charAt(0)}
                        </div>
                        <div>
                            <p className="text-white font-bold tracking-wide">Secure Call with {otherUserName}</p>
                            <p className="text-white/60 text-[10px] uppercase font-black tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> End-to-End Private
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pointer-events-auto">
                        <button 
                            onClick={() => setIsMaximized(!isMaximized)} 
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                            title={isMaximized ? "Minimize" : "Maximize"}
                        >
                            {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors active:scale-95 shadow-lg"
                            title="End Call"
                        >
                            <PhoneOff className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="w-full h-full">
                    <JitsiMeeting
                        domain="meet.jit.si"
                        roomName={roomName}
                        configOverwrite={{
                            startWithAudioMuted: false,
                            disableModeratorIndicator: true,
                            startScreenSharing: false,
                            enableEmailInStats: false,
                            prejoinPageEnabled: false,
                            disableThirdPartyRequests: true,
                            notificationServiceDisabled: true,
                            logging: {
                                defaultLogLevel: 'error'
                            },
                        }}
                        interfaceConfigOverwrite={{
                            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
                            SHOW_JITSI_WATERMARK: false,
                            SHOW_WATERMARK_FOR_GUESTS: false,
                            TOOLBAR_BUTTONS: [
                                'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
                                'fodeviceselection', 'hangup', 'profile', 'info', 'chat', 'recording',
                                'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
                                'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
                                'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
                                'security'
                            ],
                        }}
                        userInfo={{
                            displayName: userName || 'Candidate',
                            email: userEmail || `${userName.replace(/\s+/g, '.').toLowerCase()}@dbshadi.com`
                        }}
                        onApiReady={(externalApi) => {
                            // setJitsiApi(externalApi);
                            externalApi.addEventListener('videoConferenceLeft', () => {
                                onClose();
                            });
                        }}
                        getIFrameRef={(iframeRef) => {
                            iframeRef.style.height = '100%';
                            iframeRef.style.width = '100%';
                        }}
                    />
                </div>

                {/* Privacy Badge */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 pointer-events-none">
                    <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">
                        Your mobile number is not disclosed during the call
                    </p>
                </div>
            </div>
        </div>
    );
}
