"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DiscoveryCard from './DiscoveryCard';
import PrivacyToggle from './PrivacyToggle';
import ChatWindow from './ChatWindow';
import { Sparkles, Zap, Smartphone, MessageCircle, ShieldCheck, LogOut, X, Check, Clock, Loader2, CreditCard, ShieldAlert, CheckCircle, Info, Send, PauseCircle, Bell, Search, HelpCircle, Users, Megaphone, Lock, Layers, ChevronLeft, ChevronRight, Eye, ArrowRight, Bookmark, RefreshCw, Download, User, MapPin, GraduationCap, Briefcase, Phone, Mail, Camera, Heart } from 'lucide-react';
import { notifyInterestSent, notifyRequestAccepted, notifyInterestDeclined, ADMIN_EMAIL } from '@/lib/emailService';
import { useAuth } from '@/lib/contexts/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc, getDoc, onSnapshot, addDoc, serverTimestamp, orderBy, limit, increment, setDoc } from 'firebase/firestore';
import { db, messaging, storage } from '@/lib/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { requestNotificationPermission } from '@/lib/firebase/messaging';
import toast from 'react-hot-toast';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
// Deep imports are moved to dynamic imports inside the specific handler function
import { QRCodeCanvas } from 'qrcode.react';
interface UserProfile {
    id: string;
    name: string;
    dob?: string;
    jamaat?: string;
    education?: string;
    location?: string;
    hizratLocation?: string;
    isItsVerified?: boolean;
    gender?: string;
    libasImageUrl?: string;
    isDummy?: boolean;
    heightFeet?: string;
    heightInch?: string;
    hobbies?: string;
    partnerQualities?: string;
    bio?: string;
    // Enhanced fields
    ejamaatId?: string;
    itsNumber?: string;
    maritalStatus?: string;
    mobile?: string;
    mobileCode?: string;
    email?: string;
    fatherName?: string;
    motherName?: string;
    professionType?: string;
    educationDetails?: string;
    city?: string;
    state?: string;
    country?: string;
    extraImageUrl?: string;
    isBlurSecurityEnabled?: boolean;
    siblings?: string;
    noOfChildren?: string;
    citizenOf?: string;
    ancestralWatan?: string;
    hifzStatus?: string;
    employmentDetails?: string;
    serviceType?: string;
    address?: string;
    completedUpto?: string;
    isOnline?: boolean;
    lastActive?: any;
    isEmailVerified?: boolean;
    loginStreak?: number;
    lastLoginDate?: any;
    referralCount?: number;
    isCommunityContributor?: boolean;
    createdAt?: any;
    verifiedPhone?: string;
}

interface RishtaRequest {
    id: string;
    from: string;
    to: string;
    status: string;
    isIncoming: boolean;
    // Resolved Data
    otherUserName: string;
    otherUserAge: number;
    otherUserLocation: string;
    otherUserEducation: string;
    otherUserMobile: string;
    otherUserEmail: string;
    otherUserLibasUrl: string | null;
    otherUserBlurSecurityEnabled: boolean;
}

export default function RishtaDashboard() {
    const { user, loading, logout, verifyEmail, refreshUser, isImpersonating } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const adminChatParam = searchParams.get('adminChat');

    // UI State
    const [activeTab, setActiveTab] = useState<'mybiodata' | 'discovery' | 'requests' | 'messages' | 'notifications'>('discovery');

    // Sync tab with URL
    useEffect(() => {
        if (tabParam === 'notifications') {
            setActiveTab('notifications');
            router.replace('/', { scroll: false });
        } else if (tabParam === 'discovery') {
            setActiveTab('discovery');
            router.replace('/', { scroll: false });
        }
    }, [tabParam, router]);

    // Handle Admin Chat deep link (Help Icon)
    useEffect(() => {
        if (adminChatParam === 'open') {
            setShowAdminHelpChat(true);
            // Clean up URL to prevent continuous reopening
            const params = new URLSearchParams(searchParams.toString());
            params.delete('adminChat');
            const newQuery = params.toString();
            router.replace(newQuery ? `/?${newQuery}` : '/', { scroll: false });
        }
    }, [adminChatParam, router, searchParams]);
    const [dataLoading, setDataLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Live Data State
    const [discoveryProfiles, setDiscoveryProfiles] = useState<UserProfile[]>([]);
    const [allRequests, setAllRequests] = useState<RishtaRequest[]>([]);
    const [myProfile, setMyProfile] = useState<any>(null);

    // Feature Modules State
    const [activeChat, setActiveChat] = useState<{ id: string, name: string, imageUrl?: string } | null>(null);
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [paying, setPaying] = useState(false);
    const [showMyProfileModal, setShowMyProfileModal] = useState(false);
    const [activePreviewPhotoIdx, setActivePreviewPhotoIdx] = useState(0);
    const [showPreviewLightbox, setShowPreviewLightbox] = useState(false);

    // Admin Messaging State
    const [adminMsgThread, setAdminMsgThread] = useState<{ id: string; text: string; from: 'admin' | 'user'; createdAt: any }[]>([]);
    const [userMsgInput, setUserMsgInput] = useState('');
    const [showAdminMessages, setShowAdminMessages] = useState(false);
    const [itsReuploadUrl, setItsReuploadUrl] = useState<string | null>(null);
    const [showVerifiedCelebration, setShowVerifiedCelebration] = useState(false);
    const [showAdminHelpChat, setShowAdminHelpChat] = useState(false);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [recentViews, setRecentViews] = useState<any[]>([]);
    const [bookmarkedProfileIds, setBookmarkedProfileIds] = useState<Set<string>>(new Set());

    // Mobile Verification State
    const [showMobileVerifyModal, setShowMobileVerifyModal] = useState(false);
    const [newMobileVerifyInput, setNewMobileVerifyInput] = useState('');
    const [mobileVerifyOtpSent, setMobileVerifyOtpSent] = useState(false);
    const [mobileVerifyLoading, setMobileVerifyLoading] = useState(false);
    const [mobileVerifyOtpCode, setMobileVerifyOtpCode] = useState('');

    const handleSendMobileVerify = async () => {
        if (!user?.email) {
            toast.error("No registered email found for verification.");
            return;
        }
        setMobileVerifyLoading(true);
        try {
            const res = await fetch('/api/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
            });
            const data = await res.json();
            if (data.success) {
                setMobileVerifyOtpSent(true);
                toast.success("Verification code sent to " + user.email);
            } else {
                toast.error(data.error || "Failed to send code");
            }
        } catch {
            toast.error("Connection error. Try again.");
        } finally {
            setMobileVerifyLoading(false);
        }
    };

    const handleVerifyMobileVerify = async () => {
        if (!mobileVerifyOtpCode || mobileVerifyOtpCode.length !== 6) {
            toast.error("Enter the 6-digit verification code.");
            return;
        }
        if (!user?.email) return;
        setMobileVerifyLoading(true);
        try {
            const res = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code: mobileVerifyOtpCode }),
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || "Invalid verification code");
                return;
            }
            // OTP verified — save the new mobile to Firestore
            await updateDoc(doc(db, "users", user.uid), {
                mobile: newMobileVerifyInput,
                verifiedPhone: newMobileVerifyInput,
            });
            
            setMobileVerifyOtpSent(false);
            setShowMobileVerifyModal(false);
            setMobileVerifyOtpCode('');
            toast.success("✅ Mobile number verified successfully!");
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setMobileVerifyLoading(false);
        }
    };
    const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
    const [latestBroadcast, setLatestBroadcast] = useState<{ id: string; title?: string; message: string; type?: string } | null>(null);
    const [generatingBiodata, setGeneratingBiodata] = useState(false);
    const [platformStats, setPlatformStats] = useState({ count: 50, activeNow: 5 });
    const [performanceData, setPerformanceData] = useState({ views: 0, requests: 0 });
    const biodataRef = useRef<HTMLDivElement>(null);

    // Filter State for Discovery
    const [filters, setFilters] = useState({
        education: '',
        location: '',
        maritalStatus: '',
    });

    const [showSelfieModal, setShowSelfieModal] = useState(false);
    const [selfieImageUrl, setSelfieImageUrl] = useState<string | null>(null);
    const [uploadingSelfie, setUploadingSelfie] = useState(false);
    const selfieInputRef = useRef<HTMLInputElement>(null);

    // Compress the selfie on selection (same pattern as libasImageUrl)
    const handleSelfieFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const scaleSize = MAX_WIDTH / img.width;
                if (scaleSize < 1) {
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                } else {
                    canvas.width = img.width;
                    canvas.height = img.height;
                }
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                setSelfieImageUrl(canvas.toDataURL('image/jpeg', 0.5));
            };
        };
    };

    const handleSelfieUpload = async () => {
        if (!user || !selfieImageUrl) {
            toast.error('Please take a selfie first');
            return;
        }
        setUploadingSelfie(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                selfieImageUrl: selfieImageUrl,
                selfieStatus: 'pending',
                isPhotoVerified: false
            });
            toast.success('Selfie submitted for verification!');
            setShowSelfieModal(false);
            setSelfieImageUrl(null);
        } catch (err: any) {
            toast.error('Upload failed: ' + err.message);
        } finally {
            setUploadingSelfie(false);
        }
    };

    // Unblur Request State

    // Subscribe to latest broadcast
    useEffect(() => {
        if (!user) return;

        // --- Heartbeat Logic ---
        const updateStatus = async (status: boolean) => {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    isOnline: status,
                    lastActive: serverTimestamp()
                });
            } catch (e) { }
        };

        updateStatus(true);
        const interval = setInterval(() => updateStatus(true), 3 * 60 * 1000); // Heartbeat every 3m

        // Check Login Streak
        const handleStreakCheck = async () => {
            if (!user || isImpersonating) return;
            const docRef = doc(db, 'users', user.uid);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return;
            
            const data = snap.data();
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const lastLogin = data.lastLoginDate?.toDate ? data.lastLoginDate.toDate() : (data.lastLoginDate ? new Date(data.lastLoginDate) : null);
            
            if (!lastLogin) {
                await updateDoc(docRef, { lastLoginDate: serverTimestamp(), loginStreak: 1 });
            } else {
                const lastDay = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
                const diff = (today.getTime() - lastDay.getTime()) / (86400000);
                if (diff === 1) await updateDoc(docRef, { lastLoginDate: serverTimestamp(), loginStreak: increment(1) });
                else if (diff > 1) await updateDoc(docRef, { lastLoginDate: serverTimestamp(), loginStreak: 1 });
            }
        };
        handleStreakCheck();

        // Fetch Stats
        const fetchStats = () => {
            fetch('/api/public-stats').then(r => r.json()).then(d => {
                if (d.success) setPlatformStats({ count: d.count, activeNow: d.activeNow });
            }).catch(() => {});
        };
        fetchStats();
        const statsIv = setInterval(fetchStats, 60000);

        // Fetch Performance Insights
        const fetchPerformance = async () => {
            if (!user) return;
            try {
                const viewsQ = query(collection(db, 'profile_views'), where('profileId', '==', user.uid));
                const viewsSnap = await getDocs(viewsQ);
                const reqsQ = query(collection(db, 'interest_requests'), where('to', '==', user.uid));
                const reqsSnap = await getDocs(reqsQ);
                setPerformanceData({ views: viewsSnap.size, requests: reqsSnap.size });
            } catch (e) {}
        };
        fetchPerformance();

        // Process Pending Referrals
        const processReferral = async () => {
            if (!user || isImpersonating) return;
            const pendingRef = localStorage.getItem('pending_referral_code');
            if (!pendingRef) return;
            
            const uDoc = await getDoc(doc(db, 'users', user.uid));
            if (uDoc.exists() && uDoc.data().referredBy) {
                localStorage.removeItem('pending_referral_code');
                return;
            }
            if (pendingRef === user.uid) {
                localStorage.removeItem('pending_referral_code');
                return;
            }

            try {
                await updateDoc(doc(db, 'users', user.uid), { referredBy: pendingRef, referredAt: serverTimestamp() });
                await updateDoc(doc(db, 'users', pendingRef), { referralCount: increment(1), isCommunityContributor: true });
                localStorage.removeItem('pending_referral_code');
                toast.success("Joined via Community Referral! 🤝", { icon: '✨' });
            } catch (e) { localStorage.removeItem('pending_referral_code'); }
        };
        processReferral();

        // Cleanup: Set offline when tab closes/unmounts
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') updateStatus(false);
            else updateStatus(true);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const q = query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(1));
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                const bDoc = snap.docs[0];
                const bId = bDoc.id;
                const dismissed = localStorage.getItem(`dismissed_broadcast_${bId}`);
                if (!dismissed) {
                    setLatestBroadcast({ id: bId, ...bDoc.data() } as any);
                }
            }
        }, (err) => {
            console.error("Broadcast Listener Error:", err);
            // If we get permission denied, it's a sign our auth token is stale
            if (err.code === 'permission-denied' && !isImpersonating) {
                refreshUser().catch(() => {});
            }
        });
        return () => {
            unsub();
            clearInterval(interval);
            clearInterval(statsIv);
            updateStatus(false);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user]);

    // Request Notification permission ONLY ONCE on mount
    useEffect(() => {
        if (!user) return;
        const hasRequested = sessionStorage.getItem('notif_requested');
        if (!hasRequested) {
            sessionStorage.setItem('notif_requested', 'true');
            const timer = setTimeout(() => requestNotificationPermission(user.uid), 2500);
            return () => clearTimeout(timer);
        }
    }, [user]);

    // Subscribe to bookmarks
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'bookmarks'), where('userId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
            const ids = new Set<string>();
            snap.docs.forEach(d => ids.add(d.data().profileId));
            setBookmarkedProfileIds(ids);
        }, (err) => {
            console.error("Bookmarks Listener Error:", err);
        });
        return () => unsub();
    }, [user]);

    // Subscribe to profile views
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'profile_views'),
            where('profileId', '==', user.uid),
            orderBy('timestamp', 'desc'),
            limit(10)
        );
        const unsub = onSnapshot(q, (snap) => {
            // Deduplicate by viewerId to show only unique recent visitors
            const unique = new Map();
            snap.docs.forEach(d => {
                const data = d.data();
                if (!unique.has(data.viewerId)) {
                    unique.set(data.viewerId, { id: d.id, ...data });
                }
            });
            setRecentViews(Array.from(unique.values()));
        }, (err) => {
            console.error("Profile Views Listener Error:", err);
        });
        return () => unsub();
    }, [user]);

    // Accept Request Contact Modal
    const [acceptingRequest, setAcceptingRequest] = useState<RishtaRequest | null>(null);
    const [acceptMobile, setAcceptMobile] = useState('');
    const [acceptEmail, setAcceptEmail] = useState('');
    const [acceptError, setAcceptError] = useState('');

    // Subscribe to notifications collection
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
        const unsub = onSnapshot(q, (snap) => {
            const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setNotifications(notifs);

            // Calculate unread
            const unread = notifs.filter(n => !n.isRead).length;
            setUnreadNotifCount(unread);
        }, (err) => {
            console.error("Notifications Listener Error:", err);
        });
        return () => unsub();
    }, [user]);

    const markAllNotificationsRead = async () => {
        if (!user || notifications.length === 0) return;
        const unread = notifications.filter(n => !n.isRead);
        if (unread.length === 0) return;

        const { writeBatch, doc } = await import('firebase/firestore');
        const batch = writeBatch(db);
        unread.forEach(n => {
            const ref = doc(db, 'users', user.uid, 'notifications', n.id);
            batch.update(ref, { isRead: true });
        });
        await batch.commit();
    };

    const dismissNotification = async (notificationId: string) => {
        if (!user) return;
        try {
            const { deleteDoc, doc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', user.uid, 'notifications', notificationId));
        } catch (e) {
            toast.error("Failed to dismiss notification.");
        }
    };

    // Handle tab change to clear notifications
    useEffect(() => {
        if (activeTab === 'notifications' && user) {
            markAllNotificationsRead();
        }
    }, [activeTab, user]);

    // 🚀 Deployment Watcher: Keep App Updated
    useEffect(() => {
        const clientVersion = process.env.NEXT_PUBLIC_BUILD_ID;
        if (!clientVersion) return;

        const checkVersion = async () => {
            try {
                // Fetch with cache bust
                const res = await fetch(`/api/version?t=${Date.now()}`);
                const data = await res.json();
                if (data.version && data.version !== clientVersion) {
                    console.log('New deployment detected. Refreshing app...');
                    // Automatically reload to latest version
                    window.location.reload();
                }
            } catch (e) {
                // Silent fail if offline or API error
            }
        };

        // Check every 5 minutes
        const interval = setInterval(checkVersion, 5 * 60 * 1000);

        // Also check when window regains focus (user returns to app)
        window.addEventListener('focus', checkVersion);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', checkVersion);
        };
    }, []);

    const handleSendMessageToAdmin = async () => {
        if (!userMsgInput.trim() || !user) return;
        try {
            const msgRef = collection(db, 'admin_messages', user.uid, 'thread');
            await addDoc(msgRef, {
                text: userMsgInput.trim(),
                from: 'user',
                createdAt: serverTimestamp(),
            });

            // Update user document for faster admin dashboard loading
            await updateDoc(doc(db, 'users', user.uid), {
                unreadMsgCountForAdmin: increment(1),
                totalMsgCount: increment(1),
                lastMsgFromUserAt: serverTimestamp()
            });

            setUserMsgInput('');
        } catch (e: any) {
            toast.error('Could not send message.');
        }
    };

    const handleDownloadBiodata = async () => {
        if (!biodataRef.current) return;
        setGeneratingBiodata(true);
        try {
            // Lazy load html2canvas to avoid parsing errors on initialization or other pages
            const html2canvas = (await import('html2canvas')).default;
            
            const canvas = await html2canvas(biodataRef.current, {
                useCORS: true,
                scale: 2,
                backgroundColor: '#ffffff',
                logging: false, // Turn off logging to minimize console noise
            });
            const image = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.href = image;
            link.download = `Biodata_${myProfile?.name?.replace(/\s+/g, '_') || 'Profile'}.png`;
            link.click();
            toast.success("Biodata downloaded successfully!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to generate biodata image.");
        } finally {
            setGeneratingBiodata(false);
        }
    };

    const handleITSReupload = async (file: File) => {
        if (!user || !file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async (event) => {
                const dataUrl = event.target?.result as string;
                setItsReuploadUrl(dataUrl);
                await updateDoc(doc(db, 'users', user.uid), {
                    itsImageUrl: dataUrl,
                    status: 'pending_verification',
                    adminMessage: '',
                    isItsVerified: false,
                });
                toast.success('ITS photo updated! Submitted for re-verification.');
            };
        } catch (e: any) {
            toast.error('Failed to upload: ' + e.message);
        }
    };

    // 🎯 Professional First-time Tour using driver.js
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('hasSeenTour');
        if (hasSeenTour) return;

        // Wait for user data and DOM to render before starting tour
        const startTour = () => {
            const driverObj = driver({
                showProgress: true,
                animate: true,
                allowClose: true,
                overlayColor: '#881337',
                overlayOpacity: 0.6,
                stagePadding: 8,
                nextBtnText: 'Next →',
                prevBtnText: '← Back',
                doneBtnText: '🎉 Let\'s Start!',
                steps: [
                    {
                        popover: {
                            title: '🌟 Welcome to DBohraRishta!',
                            description: 'Assalaamu Alaykum! This is your trusted halal matrimonial platform. Let\'s take a quick tour to help you find your perfect match. أمين',
                            align: 'center',
                        }
                    },
                    {
                        element: '#mybiodata-nav-tab',
                        popover: {
                            title: '📋 My Biodata',
                            description: 'This is your profile section. Keep your biodata complete and up to date — a strong profile gets more interest requests!',
                            side: 'bottom',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('mybiodata'),
                    },
                    {
                        element: '#profile-completeness-section',
                        popover: {
                            title: '✏️ Complete Your Profile',
                            description: 'Click here to update your biodata, upload your ITS photo and contact details. Your profile must be verified before you can connect with others.',
                            side: 'right',
                            align: 'start',
                        },
                        onHighlightStarted: () => setActiveTab('mybiodata'),
                    },
                    {
                        element: '#selfie-verification-row',
                        popover: {
                            title: '🤳 Selfie Verification',
                            description: 'Boost your profile trust by 100%! Upload a quick selfie to get the Blue Shield badge, which makes your profile stand out in search results.',
                            side: 'bottom',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('mybiodata'),
                    },
                    {
                        element: '#download-biodata-btn',
                        popover: {
                            title: '📄 Download Digital Biodata',
                            description: 'Generate a premium, professionally formatted PDF biodata with a secure verification QR code to share with families offline.',
                            side: 'top',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('mybiodata'),
                    },
                    {
                        element: '#discovery-nav-tab',
                        popover: {
                            title: '🔍 Search Profile (Discovery)',
                            description: 'Browse verified profiles from the Dawoodi Bohra community worldwide. Filter by name, jamaat, location or education.',
                            side: 'bottom',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('discovery'),
                    },
                    {
                        element: '#discovery-search-input',
                        popover: {
                            title: '🔎 Search & Filter',
                            description: 'Use the search bar to quickly find candidates by name, jamaat, or location. All profiles are ITS verified for authenticity.',
                            side: 'bottom',
                            align: 'start',
                        },
                        onHighlightStarted: () => setActiveTab('discovery'),
                    },
                    {
                        element: '#requests-nav-tab',
                        popover: {
                            title: '💌 Interest Requests',
                            description: 'View and manage all your incoming and outgoing interest requests. Accept requests from compatible matches to share contact details.',
                            side: 'bottom',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('requests'),
                    },
                    {
                        element: '#messages-nav-tab',
                        popover: {
                            title: '🤝 Accepted Connections',
                            description: 'Once an interest is mutually accepted, photos unblur and contact info is revealed. You can also start a protected chat here.',
                            side: 'bottom',
                            align: 'center',
                        },
                        onHighlightStarted: () => setActiveTab('messages'),
                    },
                ],
                onDestroyStarted: () => {
                    localStorage.setItem('hasSeenTour', 'true');
                    setActiveTab('discovery');
                    driverObj.destroy();
                },
            });
            driverObj.drive();
        };

        // Start after 2.5s so all elements have rendered
        const timer = setTimeout(startTour, 2500);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        let unsubOutgoing: (() => void) | null = null;
        let unsubIncoming: (() => void) | null = null;
        let currentOutSnap: any = null;
        let currentInSnap: any = null;

        const resolveAndSetRequests = async (outSnap: any, inSnap: any) => {
            let requestsRaw: any[] = [];
            if (outSnap) { outSnap.forEach((d: any) => requestsRaw.push({ id: d.id, isIncoming: false, ...d.data() })); }
            if (inSnap) { inSnap.forEach((d: any) => requestsRaw.push({ id: d.id, isIncoming: true, ...d.data() })); }

            // Deduplicate to show only the latest request per target user
            const latestRequests = new Map();
            for (const req of requestsRaw) {
                const targetId = req.isIncoming ? req.from : req.to;
                const existing = latestRequests.get(targetId);
                const reqTime = req.timestamp?.toMillis ? req.timestamp.toMillis() : (req.timestamp || 0);
                const extTime = existing?.timestamp?.toMillis ? existing.timestamp.toMillis() : (existing?.timestamp || 0);
                if (!existing || reqTime > extTime) {
                    latestRequests.set(targetId, req);
                }
            }
            requestsRaw = Array.from(latestRequests.values());

            const resolvedRequests: RishtaRequest[] = [];
            for (const req of requestsRaw) {
                const targetId = req.isIncoming ? req.from : req.to;

                // Ghosting Prevention: Auto-expire pending requests older than 14 days
                if (req.status === "pending_response" && req.timestamp) {
                    const reqDate = req.timestamp?.toDate ? req.timestamp.toDate() : new Date(req.timestamp);
                    const diffDays = Math.floor((new Date().getTime() - reqDate.getTime()) / (1000 * 3600 * 24));
                    if (diffDays >= 14) {
                        try {
                            await updateDoc(doc(db, "rishta_requests", req.id), { status: "expired" });
                            req.status = "expired";
                        } catch (e) { }
                    }
                }

                try {
                    const uRef = await getDoc(doc(db, "users", targetId));
                    if (uRef.exists()) {
                        const uData = uRef.data();
                        if (uData.status === 'archived') continue;
                        resolvedRequests.push({
                            ...req,
                            otherUserName: uData.name || "Unknown Member",
                            otherUserAge: uData.dob ? Math.floor((new Date().getTime() - new Date(uData.dob).getTime()) / 31557600000) : 25,
                            otherUserLocation: uData.location || uData.hizratLocation || "Global Network",
                            otherUserEducation: uData.education || uData.profession || "Graduated",
                            otherUserMobile: uData.mobile ? `${uData.mobileCode || ''} ${uData.mobile}` : "Not Shared",
                            otherUserEmail: uData.email || "Not Shared",
                            otherUserLibasUrl: uData.libasImageUrl || null,
                            otherUserBlurSecurityEnabled: uData.isBlurSecurityEnabled !== false,
                        });
                    }
                } catch (e) { }
            }

            setAllRequests(resolvedRequests.sort((a, b) => b.status.localeCompare(a.status)));
            setDataLoading(false);
        };

        const setupRequestsListeners = () => {
            const outgoingQ = query(collection(db, "rishta_requests"), where("from", "==", user.uid));
            const incomingQ = query(collection(db, "rishta_requests"), where("to", "==", user.uid));

            unsubOutgoing = onSnapshot(outgoingQ, (snap) => {
                currentOutSnap = snap;
                if (currentInSnap) resolveAndSetRequests(currentOutSnap, currentInSnap);
            }, (err) => console.error("Outgoing Requests Error:", err));
            unsubIncoming = onSnapshot(incomingQ, (snap) => {
                currentInSnap = snap;
                if (currentOutSnap) resolveAndSetRequests(currentOutSnap, currentInSnap);
            }, (err) => console.error("Incoming Requests Error:", err));
        };

        let unsubDiscovery: (() => void) | null = null;

        const unsubMe = onSnapshot(doc(db, "users", user.uid), (meRef) => {
            if (!meRef.exists() && !isImpersonating) {
                router.push('/onboarding');
                return;
            }
            const profileData = meRef.data() || { status: 'incomplete', isItsVerified: false };
            setMyProfile({ id: meRef.id, ...profileData });

            const isVerified = profileData.isItsVerified === true || profileData.status === 'verified' || profileData.status === 'approved';
            const celebKey = `verified_celebrated_${user.uid}`;
            if (isVerified && !localStorage.getItem(celebKey)) {
                setShowVerifiedCelebration(true);
                localStorage.setItem(celebKey, 'true');
            }

            if ((profileData.status === 'rejected' || profileData.status === 'hold') && !isImpersonating) {
                setDataLoading(false);
                return;
            }

            // Once my profile is loaded, subscribe to discovery profiles
            if (!unsubDiscovery) {
                const oppositeGender = profileData.gender === 'male' ? 'female' : (profileData.gender === 'female' ? 'male' : 'all');
                const q = query(collection(db, "users"), where("isItsVerified", "==", true));

                unsubDiscovery = onSnapshot(q, (snap) => {
                    let profiles: UserProfile[] = [];
                    snap.forEach(d => {
                        const data = d.data();
                        if (d.id !== user.uid && (oppositeGender === 'all' || data.gender === oppositeGender)) {
                            profiles.push({ id: d.id, ...data } as UserProfile);
                        }
                    });

                    // Real-time sort: Online first, then by last active time descending
                    profiles.sort((a, b) => {
                        const onlineA = a.isOnline || false;
                        const onlineB = b.isOnline || false;
                        if (onlineA && !onlineB) return -1;
                        if (!onlineA && onlineB) return 1;

                        const getTime = (val: any) => {
                            if (!val) return 0;
                            if (typeof val.toMillis === 'function') return val.toMillis();
                            if (val.seconds) return val.seconds * 1000;
                            const d = new Date(val);
                            return isNaN(d.getTime()) ? 0 : d.getTime();
                        };

                        return getTime(b.lastActive) - getTime(a.lastActive);
                    });

                    setDiscoveryProfiles(profiles);
                    setDataLoading(false);
                }, (err) => {
                    console.error("Discovery Listener Error:", err);
                    setDataLoading(false); // At least stop loading
                });
            }
        }, (err) => {
            console.error("Self Profile Listener Error:", err);
            setDataLoading(false);
        });


        // --- Heartbeat Logic ---
        const updateOnlineStatus = async (online: boolean) => {
            if (!user) return;
            try {
                await updateDoc(doc(db, "users", user.uid), {
                    isOnline: online,
                    lastActive: serverTimestamp()
                });
            } catch (e) { }
        };

        const heartbeat = setInterval(() => updateOnlineStatus(true), 30000);
        updateOnlineStatus(true);

        const handleVisibilityChange = () => {
            updateOnlineStatus(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        setupRequestsListeners();

        return () => {
            clearInterval(heartbeat);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (unsubOutgoing) unsubOutgoing();
            if (unsubIncoming) unsubIncoming();
            unsubMe();
            unsubDiscovery?.();
        };
    }, [user, loading, router]);


    const handleRequestAction = async (requestId: string, newStatus: string) => {

        try {
            await updateDoc(doc(db, "rishta_requests", requestId), {
                status: newStatus
            });

            // Optimistic UI update
            setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));

            // --- 🔔 In-App Notification to Requester ---
            const requestGroup = allRequests.find(r => r.id === requestId);
            if (requestGroup && requestGroup.from && requestGroup.from !== user?.uid) {
                await addDoc(collection(db, 'users', requestGroup.from, 'notifications'), {
                    type: newStatus === 'accepted' ? 'request_accepted' : 'request_declined',
                    title: newStatus === 'accepted' ? 'INTEREST ACCEPTED' : 'REQUEST DECLINED',
                    message: newStatus === 'accepted'
                        ? `${myProfile?.name || 'Someone'} has accepted your interest! You can now view their contact details.`
                        : `${myProfile?.name || 'Someone'} has declined your interest request.`,
                    isRead: false,
                    createdAt: serverTimestamp()
                });

                // --- 💌 Email Notification for Declined Requests ---
                if (newStatus === "rejected") {
                    notifyInterestDeclined({
                        declinerName: myProfile?.name || 'Candidate',
                        declinerEmail: myProfile?.email || user?.email || '',
                        requesterName: requestGroup.otherUserName || 'Candidate',
                        requesterEmail: requestGroup.otherUserEmail || ''
                    }).catch(e => console.error("Email notify error", e));
                }
            }

            if (newStatus === "rejected") {
                toast(
                    (t) => (
                        <div className="flex items-center gap-3">
                            <span>Request declined.</span>
                            <button
                                onClick={async () => {
                                    toast.dismiss(t.id);
                                    try {
                                        await updateDoc(doc(db, "rishta_requests", requestId), { status: "pending_response" });
                                        setAllRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "pending_response" } : r));
                                        toast.success("Decline reversed, request is pending again.");
                                    } catch (e) {
                                        toast.error("Failed to reverse action.");
                                    }
                                }}
                                className="bg-gray-200 px-3 py-1 rounded text-xs font-bold text-gray-700 hover:bg-gray-300"
                            >
                                UNDO
                            </button>
                        </div>
                    ),
                    { duration: 5000, icon: '⚠️' }
                );
            } else {
                toast.success(`Request ${newStatus}!`);
            }
        } catch (error: any) {
            toast.error("Action failed: " + error.message);
        }
    };

    const handleAcceptClick = (req: RishtaRequest) => {
        setAcceptError('');
        setAcceptMobile(myProfile?.mobile ? `${myProfile.mobileCode || ''} ${myProfile.mobile}`.trim() : '');
        setAcceptEmail(myProfile?.email || '');
        setAcceptingRequest(req);
    };

    const confirmAcceptRequest = async () => {
        setAcceptError('');
        if (!acceptMobile || !acceptEmail) {
            setAcceptError("Mobile and Email are compulsory to share when accepting.");
            return;
        }
        if (!user || !acceptingRequest) return;

        try {
            await updateDoc(doc(db, "users", user.uid), {
                mobile: acceptMobile,
                email: acceptEmail
            });
            await handleRequestAction(acceptingRequest.id, "accepted");

            // Integrated Hybrid Email Notifications for Acceptance (Dual Party + Admin CC)
            notifyRequestAccepted({
                acceptorName: myProfile?.name || 'Candidate',
                acceptorEmail: acceptEmail,
                acceptorMobile: acceptMobile,
                requesterName: acceptingRequest.otherUserName,
                requesterEmail: acceptingRequest.otherUserEmail,
                requesterMobile: acceptingRequest.otherUserMobile
            }).catch(e => console.error("Email notify error", e));
            setAcceptMobile('');
            setAcceptEmail('');
            setAcceptingRequest(null);
            toast.success("Request accepted! Contacts shared.");
        } catch (err: any) {
            toast.error("Failed to accept: " + err.message);
        }
    };


    const handleUpgradeToPremium = async () => {
        if (!user) return;
        try {
            setPaying(true);
            // MOCK TRANSACTION DB CALL
            await updateDoc(doc(db, "users", user.uid), {
                isPremium: true,
                premiumSince: new Date().toISOString()
            });
            toast.success("Payment Successful! ₹53/mo plan active.", { icon: '🎉' });
            setShowPremiumModal(false);
        } catch (err: any) {
            toast.error("Payment failed: " + err.message);
        } finally {
            setPaying(false);
        }
    };

    const renderTabContent = () => {
        if (dataLoading) {
            return (
                <section className={`${activeTab === 'discovery' ? 'lg:col-span-3' : 'lg:col-span-4'} flex items-center justify-center p-24`}>
                    <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin" />
                </section>
            );
        }
        if (myProfile?.status === 'rejected' && !isImpersonating) {
            return (
                <section className={`${activeTab === 'discovery' ? 'lg:col-span-3' : 'lg:col-span-4'} flex items-center justify-center p-12`}>
                    <div className="bg-red-50 p-12 rounded-3xl shadow-sm text-center border border-red-100 flex flex-col items-center">
                        <X className="w-16 h-16 text-red-500 mb-4" />
                        <h2 className="text-2xl font-bold text-red-700 mb-2">Biodata Verification Rejected</h2>
                        <p className="text-red-600 mb-6 max-w-md">Your biodata has been reviewed and unfortunately was not approved at this time. Please check your messages from admin for details.</p>
                        <button onClick={() => router.push('/candidate-registration')} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-all">Update My Biodata</button>
                    </div>
                </section>
            );
        }

        if (myProfile?.status === 'hold' && !isImpersonating) {
            return (
                <section className={`${activeTab === 'discovery' ? 'lg:col-span-3' : 'lg:col-span-4'} flex items-center justify-center p-12`}>
                    <div className="bg-yellow-50 p-12 rounded-3xl shadow-sm text-center border border-yellow-100 flex flex-col items-center">
                        <Clock className="w-16 h-16 text-yellow-500 mb-4" />
                        <h2 className="text-2xl font-bold text-yellow-700 mb-2">Biodata Verification On Hold</h2>
                        <p className="text-yellow-600 mb-6 max-w-md">Your biodata is currently on hold by an administrator. Please check your messages from admin for details.</p>
                        <button onClick={() => router.push('/candidate-registration')} className="bg-yellow-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-yellow-700 transition-all">Review My Biodata</button>
                    </div>
                </section>
            );
        }

        switch (activeTab) {
            case 'requests':
                const pendingRequests = allRequests.filter(r => r.status === "pending_response");
                return (
                    <section className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold font-serif">Interest Requests</h2>
                        </div>
                        {pendingRequests.length === 0 ? (
                            <div style={{ backgroundColor: '#ffffff', borderColor: '#f3f4f6' }} className="p-12 rounded-3xl shadow-sm text-center border flex flex-col items-center">
                                <ShieldCheck className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">No active pending requests.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pendingRequests.map((req) => (
                                    <div key={req.id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 bg-gradient-to-br from-[#881337] to-[#D4AF37] opacity-80 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-sm text-xl relative overflow-hidden shrink-0">
                                                {req.otherUserLibasUrl ? (
                                                    <img src={req.otherUserLibasUrl} alt="User" className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${req.otherUserBlurSecurityEnabled ? 'blur-md scale-110 opacity-70' : 'opacity-100 scale-100'}`} />
                                                ) : (
                                                    <span className="z-10 relative">{req.otherUserName.charAt(0)}</span>
                                                )}
                                                {req.otherUserBlurSecurityEnabled && !req.otherUserLibasUrl && <div className="absolute inset-0 backdrop-blur-md"></div>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg text-[#881337]">{req.otherUserName}, {req.otherUserAge}</h4>
                                                <p className="text-sm text-gray-500">{req.otherUserLocation}</p>
                                            </div>
                                        </div>
                                        {req.isIncoming ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleRequestAction(req.id, "rejected")} className="bg-red-50 text-red-600 p-3 rounded-full hover:bg-red-100 transition-colors shadow-sm"><X className="w-5 h-5" /></button>
                                                <button onClick={() => handleAcceptClick(req)} className="bg-[#881337] text-white p-3 rounded-full hover:bg-[#9F1239] transition-colors shadow-md"><Check className="w-5 h-5" /></button>
                                            </div>
                                        ) : (
                                            <div className="flex gap-2 items-center text-gray-500 text-sm font-bold bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                                                <Clock className="w-4 h-4" /> Sent
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            case 'messages':
                const acceptedRequests = allRequests.filter(r => r.status === "accepted");

                if (activeChat) {
                    return (
                        <section className="lg:col-span-4">
                            <ChatWindow
                                connectionId={activeChat.id}
                                otherUserName={activeChat.name}
                                otherUserImageUrl={activeChat.imageUrl}
                                onClose={() => setActiveChat(null)}
                            />
                        </section>
                    );
                }

                return (
                    <section className="lg:col-span-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h2 className="text-2xl font-bold font-serif mb-6">Unblurred Alignments</h2>
                        {acceptedRequests.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100 flex flex-col items-center">
                                <MessageCircle className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-gray-500 font-bold">No accepted interest requests yet.</p>
                                <p className="text-gray-400 text-sm mt-2">When a request is approved, their photos unblur and you can chat here!</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                                {acceptedRequests.map((msg) => (
                                    <div key={msg.id} className="p-5 flex flex-col md:flex-row items-start md:items-center gap-5 hover:bg-gray-50 transition-colors relative">

                                        <div className="flex flex-col items-center shrink-0">
                                            <div className="w-20 h-20 bg-rose-50 text-[#881337] rounded-full flex items-center justify-center text-xl font-bold border border-rose-100 relative overflow-hidden mb-2">
                                                {/* Because it is ACCEPTED, photos unblur and are shown! */}
                                                {msg.otherUserLibasUrl ? (
                                                    <img src={msg.otherUserLibasUrl} alt="Match" className="w-full h-full object-cover" />
                                                ) : (
                                                    <span>{msg.otherUserName.charAt(0)}</span>
                                                )}
                                                {msg.isIncoming && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>}
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{msg.otherUserLocation.split(',')[0]}</p>
                                                <p className="text-xs text-[#881337] font-medium max-w-[100px] truncate">{msg.otherUserEducation}</p>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full mt-4 md:mt-0">
                                            <div className="flex justify-between items-start md:items-center mb-1">
                                                <div>
                                                    <h4 className="font-bold text-lg text-[#881337]">{msg.otherUserName}</h4>
                                                    <div className="flex items-center gap-3 text-sm text-gray-600 font-medium mt-1">
                                                        <span>📞 {msg.otherUserMobile}</span>
                                                        <span className="hidden sm:inline">|</span>
                                                        <span>✉️ {msg.otherUserEmail}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <span className={`text-xs ${msg.isIncoming ? 'text-[#D4AF37] font-bold bg-[#D4AF37]/10 px-2 py-1 rounded-full' : 'text-gray-400'}`}>Accepted Matched</span>
                                                    {/* Premium Badges for Matches */}
                                                    <div className="flex gap-1">
                                                        {msg.otherUserEducation?.toLowerCase().includes('hafiz') && <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-emerald-200">Hafiz</span>}
                                                        {(msg.otherUserEducation?.toLowerCase().includes('graduate') || msg.otherUserEducation?.toLowerCase().includes('mba')) && <span className="bg-blue-100 text-blue-800 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-blue-200">Educated</span>}
                                                        {msg.otherUserLocation?.toLowerCase().includes('mumbai') && <span className="bg-rose-100 text-rose-800 text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm border border-rose-200">Mumbai</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className={`text-sm ${msg.isIncoming ? 'text-gray-900 font-bold' : 'text-gray-500'} mb-4 mt-2`}>Alhamdulillah, Interest Request Accepted! Direct contact info is now visible.</p>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => {
                                                        setActiveChat({ id: msg.id, name: msg.otherUserName, imageUrl: msg.otherUserLibasUrl || undefined });
                                                    }}
                                                    className="bg-[#881337] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-[#9F1239] transition-all flex items-center gap-2">
                                                    <MessageCircle className="w-4 h-4" /> Start Protected Chat
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm("Are you sure you want to end this connection?")) {
                                                            handleRequestAction(msg.id, "rejected");
                                                        }
                                                    }}
                                                    className="bg-white border text-red-600 border-red-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-50 transition-all flex items-center gap-2">
                                                    <X className="w-4 h-4" /> End Connection
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                );
            case 'discovery':
            default:
                // Filter out profiles where there is already an accepted connection or the user is the sender of a pending request
                const hiddenProfileIds = new Set<string>();
                allRequests.forEach(r => {
                    if (r.status === "accepted") {
                        // Hide accepted connections from discovery (they appear in Messages)
                        const otherId = r.isIncoming ? r.from : r.to;
                        hiddenProfileIds.add(otherId);
                    }
                });

                const computeMatchScore = (me: any, them: any) => {
                    let score = 50;
                    if (!me || !them) return score;

                    if (me.country && them.country && me.country.toLowerCase() === them.country.toLowerCase()) score += 10;
                    if (me.state && them.state && me.state.toLowerCase() === them.state.toLowerCase()) score += 10;
                    if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) score += 10;

                    const myAge = me.dob ? new Date().getFullYear() - new Date(me.dob).getFullYear() : 25;
                    const theirAge = them.dob ? new Date().getFullYear() - new Date(them.dob).getFullYear() : 25;
                    const ageDiff = Math.abs(myAge - theirAge);

                    if (me.gender === 'male' && theirAge <= myAge && theirAge >= myAge - 6) score += 15;
                    else if (me.gender === 'female' && myAge <= theirAge && myAge >= theirAge - 6) score += 15;
                    else score -= Math.max(0, (ageDiff - 6) * 2);

                    const myHobbies = (me.hobbies || '').toLowerCase();
                    const theirHobbies = (them.hobbies || '').toLowerCase();
                    const myReqs = (me.partnerQualities || '').toLowerCase();
                    const theirReqs = (them.partnerQualities || '').toLowerCase();

                    if (myHobbies && theirHobbies) {
                        const hWords = myHobbies.split(/[,\s]+/).filter((w: string) => w.length > 3);
                        hWords.forEach((w: string) => {
                            if (theirHobbies.includes(w)) score += 5;
                        });
                    }

                    if (myReqs && (them.education || them.profession)) {
                        const rWords = myReqs.split(/[,\s]+/).filter((w: string) => w.length > 3);
                        let matched = false;
                        rWords.forEach((w: string) => {
                            if ((them.education || '').toLowerCase().includes(w) || (them.profession || '').toLowerCase().includes(w) || theirHobbies.includes(w)) {
                                matched = true;
                            }
                        });
                        if (matched) score += 10;
                    }

                    return Math.min(99, Math.max(30, score));
                };

                const availableProfiles = discoveryProfiles.filter(p => !hiddenProfileIds.has(p.id));

                const filteredProfiles = availableProfiles.filter(p => {
                    const matchesSearch = !searchQuery ||
                        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.jamaat?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.hizratLocation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.education?.toLowerCase().includes(searchQuery.toLowerCase());

                    const matchesEducation = !filters.education || p.education?.toLowerCase().includes(filters.education.toLowerCase());
                    const matchesLocation = !filters.location || p.location?.toLowerCase().includes(filters.location.toLowerCase()) || p.hizratLocation?.toLowerCase().includes(filters.location.toLowerCase()) || p.city?.toLowerCase().includes(filters.location.toLowerCase());
                    const matchesMarital = !filters.maritalStatus || p.maritalStatus?.toLowerCase() === filters.maritalStatus.toLowerCase();

                    if (showOnlyBookmarked) {
                        return matchesSearch && matchesEducation && matchesLocation && matchesMarital && bookmarkedProfileIds.has(p.id);
                    }
                    return matchesSearch && matchesEducation && matchesLocation && matchesMarital;
                }).sort((a, b) => {
                    // Priority 1: Online Status
                    const onlineA = a.isOnline || false;
                    const onlineB = b.isOnline || false;
                    if (onlineA && !onlineB) return -1;
                    if (!onlineA && onlineB) return 1;

                    // Priority 2: New Member Spike (Joined last 7 days)
                    const getTime = (val: any) => {
                        if (!val) return 0;
                        if (typeof val.toMillis === 'function') return val.toMillis();
                        if (val.seconds) return val.seconds * 1000;
                        const d = new Date(val);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };
                    const isNewA = (Date.now() - getTime(a.createdAt)) < 604800000;
                    const isNewB = (Date.now() - getTime(b.createdAt)) < 604800000;
                    if (isNewA && !isNewB) return -1;
                    if (!isNewA && isNewB) return 1;

                    // Priority 3: Login Streak Boost (Daily Presence)
                    const streakA = (a as any).loginStreak || 0;
                    const streakB = (b as any).loginStreak || 0;
                    if (streakA !== streakB) return streakB - streakA;

                    // Priority 4: Match Score (for logged-in users)
                    if (myProfile) {
                        const scoreA = computeMatchScore(myProfile, a);
                        const scoreB = computeMatchScore(myProfile, b);
                        if (scoreA !== scoreB) return scoreB - scoreA;
                    }

                    // Priority 5: Last Active Time
                    return getTime(b.lastActive) - getTime(a.lastActive);
                });

                return (
                    <section className="lg:col-span-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="mb-6">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                <h2 className="text-2xl font-bold font-serif">Community Discovery</h2>
                                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1">
                                    <button
                                        onClick={() => setShowOnlyBookmarked(!showOnlyBookmarked)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border shadow-sm shrink-0 ${showOnlyBookmarked ? 'bg-[#881337] text-white border-[#881337]' : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}`}
                                    >
                                        <Bookmark className="w-3.5 h-3.5" fill={showOnlyBookmarked ? 'currentColor' : 'none'} />
                                        {showOnlyBookmarked ? 'Saved' : 'Saved'}
                                    </button>
                                    <input
                                        id="discovery-search-input"
                                        type="text"
                                        placeholder="Name, Jamaat, Education..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="px-4 py-2 rounded-xl text-sm border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37] w-full md:w-48"
                                    />
                                </div>
                            </div>

                            {/* --- SMART FILTERS --- */}
                            <div className="grid grid-cols-3 gap-2 bg-white/50 backdrop-blur-sm p-2 rounded-2xl border border-[#D4AF37]/20 shadow-sm">
                                <select
                                    value={filters.location}
                                    onChange={(e) => setFilters(f => ({ ...f, location: e.target.value }))}
                                    className="bg-white border-none rounded-xl text-[10px] font-bold text-gray-600 focus:ring-1 focus:ring-[#D4AF37] p-2 outline-none"
                                >
                                    <option value="">Any Location</option>
                                    <option value="Mumbai">Mumbai</option>
                                    <option value="Karachi">Karachi</option>
                                    <option value="Dubai">Dubai</option>
                                    <option value="London">London</option>
                                    <option value="Colombo">Colombo</option>
                                </select>
                                <select
                                    value={filters.maritalStatus}
                                    onChange={(e) => setFilters(f => ({ ...f, maritalStatus: e.target.value }))}
                                    className="bg-white border-none rounded-xl text-[10px] font-bold text-gray-600 focus:ring-1 focus:ring-[#D4AF37] p-2 outline-none"
                                >
                                    <option value="">Marital Status</option>
                                    <option value="Single">Always Single</option>
                                    <option value="Divorced">Divorced</option>
                                    <option value="Widowed">Widowed</option>
                                </select>
                                <select
                                    value={filters.education}
                                    onChange={(e) => setFilters(f => ({ ...f, education: e.target.value }))}
                                    className="bg-white border-none rounded-xl text-[10px] font-bold text-gray-600 focus:ring-1 focus:ring-[#D4AF37] p-2 outline-none"
                                >
                                    <option value="">Education Level</option>
                                    <option value="Masters">Post-Graduate</option>
                                    <option value="Graduate">Graduate</option>
                                    <option value="Hafiz">Hafiz-ul-Quran</option>
                                </select>
                            </div>
                        </div>


                        {filteredProfiles.length === 0 ? (
                            <div className="bg-white p-12 rounded-3xl shadow-sm text-center border border-gray-100">
                                <p className="text-gray-500 font-bold">No new biodatas found dynamically.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-max">
                                {filteredProfiles.map((p) => {
                                    // Check if this profile has a pending or accepted request from/to the current user
                                    const relatedReq = allRequests.find(r => {
                                        const otherId = r.isIncoming ? r.from : r.to;
                                        return otherId === p.id;
                                    });
                                    const isAccepted = relatedReq?.status === 'accepted';
                                    const blurEnabled = isAccepted ? false : (p.isBlurSecurityEnabled !== false);

                                    return (
                                        <DiscoveryCard
                                            key={p.id}
                                            {...p}
                                            matchScore={computeMatchScore(myProfile, p)}
                                            isMyProfileVerified={myProfile?.isItsVerified === true}
                                            bio={p.bio}
                                            isBlurSecurityEnabled={blurEnabled}
                                            viewerItsNumber={myProfile?.itsNumber || ''}
                                            createdAt={p.createdAt}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </section>
                );
        }
    };

    if (loading) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] text-[#881337] p-3 pb-24 md:p-12 md:pb-12">
            <header className="max-w-7xl mx-auto mb-4 hidden md:flex items-center">
                <div className="flex-1">
                    <nav className="flex bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-x divide-gray-100">
                        {(['mybiodata', 'discovery', 'requests', 'messages'] as const).map((tab) => (
                            <button
                                key={tab}
                                id={`${tab}-nav-tab`}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? 'bg-rose-50/50 text-[#881337]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    {tab === 'mybiodata' ? 'My Biodata'
                                        : tab === 'messages' ? 'Accepted (Chat Now)'
                                            : tab === 'discovery' ? 'Search Profile'
                                                : 'Requests'}
                                    {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#881337]" />}
                                </div>
                            </button>
                        ))}
                    </nav>
                </div>
                {/* ── Floating Admin Help Chat Panel ── */}
                {showAdminHelpChat && (
                    <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ maxHeight: '460px' }}>
                        {/* Header */}
                        <div className="bg-gradient-to-r from-[#881337] to-[#9F1239] px-4 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-white text-sm">🛡️</div>
                                <div>
                                    <p className="text-white font-bold text-sm">Admin Support</p>
                                    <p className="text-white/70 text-[10px]">DBohraRishta Team</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAdminHelpChat(false)} className="text-white/80 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 bg-gray-50">
                            {adminMsgThread.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-2xl mb-2">👋</p>
                                    <p className="text-gray-500 text-sm font-bold">Need help?</p>
                                    <p className="text-gray-400 text-xs mt-1">Send a message and the admin team will reply shortly.</p>
                                </div>
                            ) : (
                                adminMsgThread.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.from === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${msg.from === 'admin'
                                            ? 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                                            : 'bg-[#881337] text-white rounded-tr-sm'
                                            }`}>
                                            <p className="text-[9px] font-bold uppercase opacity-60 mb-0.5">{msg.from === 'admin' ? 'Admin' : 'You'}</p>
                                            <p>{msg.text}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Input */}
                        <div className="border-t border-gray-100 p-3 bg-white flex gap-2 shrink-0">
                            <input
                                type="text"
                                value={userMsgInput}
                                onChange={e => setUserMsgInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessageToAdmin(); } }}
                                placeholder="Type your message..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#881337]/30 focus:border-[#881337]"
                            />
                            <button
                                onClick={handleSendMessageToAdmin}
                                disabled={!userMsgInput.trim()}
                                className="w-9 h-9 bg-[#881337] text-white rounded-xl flex items-center justify-center hover:bg-[#9F1239] transition-colors disabled:opacity-40"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

            </header>

            {/* 📢 Broadcast Banner */}
            {latestBroadcast && (
                <div className="max-w-7xl mx-auto mb-5 rounded-2xl border-2 border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50 shadow-lg overflow-hidden animate-in slide-in-from-top-4">
                    <div className="flex items-start gap-4 p-5 md:p-6">
                        <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-md">
                            <Megaphone className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-black text-xl text-indigo-900 mb-1">{latestBroadcast.title || '📣 Official Announcement'}</h3>
                            <p className="text-indigo-800 text-sm leading-relaxed whitespace-pre-wrap">
                                {latestBroadcast.message || (latestBroadcast as any).text}
                            </p>
                            <div className="flex gap-3 mt-3 flex-wrap">
                                <button
                                    onClick={() => {
                                        localStorage.setItem(`dismissed_broadcast_${latestBroadcast.id}`, 'true');
                                        setLatestBroadcast(null);
                                    }}
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-xs font-bold shadow hover:bg-indigo-700 transition-all"
                                >
                                    Dismiss Message
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🎉 Verified Celebration Banner */}
            {showVerifiedCelebration && (
                <div className="max-w-7xl mx-auto mb-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50 to-green-50 shadow-lg overflow-hidden">
                    <div className="flex items-start gap-4 p-5 md:p-6">
                        <div className="text-4xl shrink-0 animate-bounce">🎊</div>
                        <div className="flex-1">
                            <h3 className="font-black text-xl text-emerald-800 mb-1">Mubarak! Your Profile is Successfully Verified ✨</h3>
                            <p className="text-emerald-700 text-sm leading-relaxed">
                                You can now send Rishta requests and access all the amazing features of this application.
                                May Allah bless you and help you find your Soulmate soon. <strong>Shukran! 🤲</strong>
                            </p>
                            <div className="flex gap-3 mt-3 flex-wrap">
                                <button onClick={() => { setActiveTab('discovery'); setShowVerifiedCelebration(false); }} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow transition-all">
                                    🌟 Start Discovering Matches
                                </button>
                                <button onClick={() => setShowVerifiedCelebration(false)} className="bg-white border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Admin Notification Banner (shown across all tabs) ── */}
            {myProfile && (myProfile.status === 'rejected' || myProfile.status === 'hold') && (
                <div className={`max-w-7xl mx-auto mb-5 rounded-2xl border-2 shadow-sm ${myProfile.status === 'rejected' ? 'bg-rose-50 border-rose-300' : 'bg-yellow-50 border-yellow-300'}`}>
                    <div className="flex items-start justify-between gap-3 p-4 md:p-5">
                        <div className="flex gap-3 flex-1">
                            <div className="shrink-0 text-2xl mt-0.5">{myProfile.status === 'rejected' ? '⚠️' : '⏸️'}</div>
                            <div className="flex-1">
                                <h3 className={`font-black text-base mb-1 ${myProfile.status === 'rejected' ? 'text-[#881337]' : 'text-yellow-800'}`}>
                                    {myProfile.status === 'rejected' ? 'Action Required: Profile Needs Updates' : '⏸️ Your Profile is On Hold by Admin'}
                                </h3>
                                <p className="text-gray-700 text-sm mb-2">
                                    {myProfile.status === 'rejected'
                                        ? 'An Admin has reviewed your profile and requested some adjustments. Please fix the issue below and resubmit.'
                                        : 'See the message from Administration below to understand what needs to be corrected to get your profile Accepted. You may also send a message to Admin by the below chat option.'}
                                </p>
                                {myProfile.adminMessage && (
                                    <div className={`px-4 py-3 rounded-xl text-sm italic font-medium border ${myProfile.status === 'rejected' ? 'bg-white border-rose-100 text-rose-800' : 'bg-white border-yellow-100 text-yellow-800'}`}>
                                        💬 &quot;{myProfile.adminMessage}&quot;
                                    </div>
                                )}
                                <div className="flex gap-3 mt-3 flex-wrap">
                                    {myProfile.status === 'rejected' && (
                                        <button onClick={() => router.push('/candidate-registration')} className="bg-[#881337] text-white px-4 py-2 rounded-xl text-xs font-bold shadow hover:bg-rose-900 transition-all">
                                            ✏️ Update &amp; Resubmit Profile
                                        </button>
                                    )}
                                    {/* ITS Re-upload in banner for rejected/hold */}
                                    {!myProfile.isItsVerified && (
                                        <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5">
                                            📷 {itsReuploadUrl ? 'ITS Uploaded ✓' : 'Re-upload ITS Photo'}
                                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleITSReupload(f); }} />
                                        </label>
                                    )}
                                    <button
                                        onClick={() => setShowAdminHelpChat(true)}
                                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all flex items-center gap-1.5"
                                    >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Message Admin
                                    </button>
                                    <button
                                        onClick={() => router.push('/success-stories')}
                                        className="h-10 px-4 bg-rose-50 border border-rose-100 text-[#881337] rounded-xl text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-2"
                                    >
                                        <Sparkles className="w-4 h-4 text-[#D4AF37]" /> Success Stories
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Recent Profile Visitors Section */}
                        {recentViews.length > 0 && (
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6 group animate-in slide-in-from-top duration-500">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-[#881337]" />
                                        </div>
                                        <h3 className="text-sm font-black text-[#881337] uppercase tracking-wider">Profile Visitors</h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full uppercase">Last 10 Views</span>
                                </div>
                                <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-none">
                                    {recentViews.map((visitor) => (
                                        <div
                                            key={visitor.id}
                                            onClick={() => router.push(`/profile?id=${visitor.viewerId}`)}
                                            className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group/v"
                                        >
                                            <div className="relative">
                                                <div className="w-14 h-14 rounded-full border-2 border-white shadow-sm overflow-hidden ring-2 ring-transparent group-hover/v:ring-[#881337]/20 transition-all">
                                                    {visitor.viewerLibasUrl ? (
                                                        <img src={visitor.viewerLibasUrl} alt={visitor.viewerName} className="w-full h-full object-cover grayscale-[0.5] group-hover/v:grayscale-0 transition-all blur-[2px] group-hover/v:blur-0" />
                                                    ) : (
                                                        <div className="w-full h-full bg-rose-50 flex items-center justify-center text-[#881337] font-black text-xl">
                                                            {visitor.viewerName[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white" title="Active" />
                                            </div>
                                            <p className="text-[10px] font-bold text-gray-600 truncate w-16 text-center group-hover/v:text-[#881337]">{visitor.viewerName.split(' ')[0]}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {/* 🚀 ENGAGEMENT HUB — HORIZONTAL CAROUSEL ON MOBILE / GRID ON DESKTOP */}
            {/* 🚀 ENGAGEMENT HUB — COMPACT STATUS & CARDS */}
            <div className="max-w-7xl mx-auto mb-4 flex items-center justify-between overflow-x-auto no-scrollbar gap-3 pb-1">
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white border border-gray-100 text-gray-600 px-3 py-2 rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <Eye className="w-3.5 h-3.5 text-emerald-500" /> {performanceData.views} Views
                    </div>
                    <div className="flex items-center gap-1.5 bg-white border border-gray-100 text-gray-600 px-3 py-2 rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-wider backdrop-blur-sm">
                        <Heart className="w-3.5 h-3.5 text-[#881337]" /> {performanceData.requests} Interests
                    </div>
                </div>
                <button 
                    onClick={() => requestNotificationPermission(user?.uid)}
                    className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-600 px-3 py-2 rounded-2xl shadow-sm text-[10px] font-black uppercase tracking-wider hover:bg-indigo-100 transition-all shrink-0 active:scale-95"
                >
                    <Bell className="w-3.5 h-3.5 animate-bounce" /> Notify Me
                </button>
            </div>

            <div id="engagement-hub" className="max-w-7xl mx-auto mb-6 md:mb-10 flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 snap-x scroll-smooth no-scrollbar pb-4 md:pb-0 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
                {/* Visibility Boost Card */}
                <div id="daily-streak-card" className="flex-shrink-0 w-[85%] md:w-auto snap-start relative group overflow-hidden bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-7 border border-white shadow-[0_20px_50px_rgba(136,19,55,0.05)] hover:shadow-[0_40px_80px_rgba(136,19,55,0.15)] hover:-translate-y-2 transition-all duration-500 ease-out">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-amber-100/30 to-[#D4AF37]/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                    <div className="flex items-center gap-4 md:gap-6 relative z-10">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-amber-50 to-amber-200 rounded-2xl md:rounded-3xl flex items-center justify-center text-[#D4AF37] shadow-inner group-hover:rotate-[360deg] transition-transform duration-[1200ms] border border-white">
                            <Zap className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] leading-none">Smart Ranking</span>
                                {myProfile?.loginStreak > 1 && <span className="bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_15px_rgba(212,175,55,0.4)] animate-pulse">🔥 {myProfile.loginStreak}D</span>}
                            </div>
                            <p className="text-base md:text-lg font-black text-gray-900 leading-none">Visibility Spike</p>
                            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed italic">Your profile is currently <span className="text-amber-600 font-black">{myProfile?.loginStreak > 0 ? "Boosted" : "Active"}</span>.</p>
                        </div>
                    </div>
                </div>

                {/* Live Platform Stats */}
                <div id="platform-footprint-card" className="flex-shrink-0 w-[85%] md:w-auto snap-start relative group overflow-hidden bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-7 border border-white shadow-[0_20px_50px_rgba(136,19,55,0.05)] hover:shadow-[0_40px_80px_rgba(136,19,55,0.15)] hover:-translate-y-2 transition-all duration-500 ease-out">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-gradient-to-br from-rose-100/30 to-[#881337]/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                    <div className="flex items-center gap-4 md:gap-6 relative z-10">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl md:rounded-3xl flex items-center justify-center text-[#881337] shadow-inner group-hover:rotate-[360deg] transition-transform duration-[1200ms] border border-white">
                            <Users className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em] leading-none mb-1 block">Live Activity</span>
                            <p className="text-base md:text-lg font-black text-gray-900 leading-none truncate">{platformStats.count}+ Candidates</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping absolute" />
                                <span className="w-2 h-2 bg-emerald-500 rounded-full relative" />
                                <span className="text-[10px] text-emerald-600 font-bold">{platformStats.activeNow} online now</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 🤝 Referral Program (Refer-a-Relative) */}
                <div
                    id="referral-reward-card"
                    className="flex-shrink-0 w-[85%] md:w-auto snap-start relative group overflow-hidden bg-gradient-to-br from-[#881337] to-[#4c0519] rounded-[2.5rem] p-6 md:p-7 border border-[#881337]/20 shadow-[0_20px_50px_rgba(136,19,55,0.2)] hover:shadow-[0_40px_80px_rgba(136,19,55,0.3)] hover:-translate-y-2 transition-all duration-500 ease-out cursor-pointer"
                    onClick={() => {
                        const link = `https://www.53dbohrarishta.in/login?ref=${user?.uid}`;
                        const text = `Assalamu Alaikum!\nI’m using 53DBohraRishta to find genuine, serious matches within our Bohra community. It’s a trusted space built on respect, privacy, and meaningful connections.\n\nالسلام علیکم!\nહું 53DBohraRishta નો ઉપયોગ કરી રહ્યો છું અમારા બોહરા સમાજમાં ગંભીર અને સાચા સંબંધો શોધવા માટે. આ એક વિશ્વસનીય પ્લેટફોર્મ છે જે ગોપનીયતા, આદર અને અર્થપૂર્ણ જોડાણો પર આધારિત છે.\n\n👉 Join here now: ${link}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }}
                >
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                    <div className="flex items-center gap-4 md:gap-6 relative z-10">
                        <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-inner group-hover:scale-110 transition-transform duration-500 border border-white/20">
                            <Megaphone className="w-6 h-6 md:w-8 md:h-8" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-rose-200 uppercase tracking-[0.2em] leading-none mb-1 block">Community Growth</span>
                            <p className="text-base md:text-lg font-black text-white leading-none">Refer a Relative</p>
                            <p className="text-[10px] text-rose-100/60 mt-2 leading-relaxed italic">Help the community grow.</p>
                        </div>
                    </div>
                </div>
            </div>

            <main className="max-w-7xl mx-auto">

                {/* MY BIODATA TAB */}
                {activeTab === 'mybiodata' && myProfile && (
                    <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div id="profile-completeness-section" className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center">

                            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-rose-50 mb-4 shadow-md relative">
                                {myProfile.isPhotoVerified && myProfile.selfieImageUrl ? (
                                    <img src={myProfile.selfieImageUrl} alt="Biodata" className="w-full h-full object-cover" />
                                ) : myProfile.libasImageUrl || myProfile.extraImageUrl || myProfile.itsImageUrl ? (
                                    <img src={myProfile.libasImageUrl || myProfile.extraImageUrl || myProfile.itsImageUrl} alt="Biodata" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-4xl">
                                        {myProfile.name?.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <h3 className="font-bold text-2xl text-[#881337] text-center font-serif">{myProfile.name}</h3>
                            <p className="text-sm text-gray-500 mb-2">ITS: {myProfile.itsNumber} · {myProfile.jamaat}</p>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-1 mb-4">
                                {myProfile.isItsVerified ? (
                                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-emerald-100"><Check className="w-3 h-3" /> ITS Verified</span>
                                ) : (
                                    <span className="bg-yellow-50 text-yellow-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-yellow-100"><Clock className="w-3 h-3" /> ITS Pending</span>
                                )}
                                {user?.emailVerified || myProfile.isEmailVerified ? (
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-blue-100"><Check className="w-3 h-3" /> Email Verified</span>
                                ) : (
                                    <div className="flex flex-col items-center gap-1">
                                        <span onClick={async () => {
                                            try { await verifyEmail(); toast.success("Verification Email Sent!"); } catch (e) { toast.error("Try later."); }
                                        }} className="bg-gray-50 text-gray-600 px-3 py-1 cursor-pointer hover:bg-gray-100 transition-colors rounded-full text-xs font-bold flex items-center gap-1 border border-gray-200">
                                            <Clock className="w-3 h-3" /> Verify Email
                                        </span>
                                        <button onClick={refreshUser} className="text-[10px] text-gray-400 hover:text-[#881337] font-bold underline">Refresh status</button>
                                    </div>
                                )}
                                {myProfile.verifiedPhone ? (
                                    <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 border border-orange-100"><Check className="w-3 h-3" /> Mobile Verified</span>
                                ) : (
                                    <span onClick={() => {
                                        setNewMobileVerifyInput(myProfile.mobile || '');
                                        setShowMobileVerifyModal(true);
                                    }} className="bg-gray-50 text-gray-600 px-3 py-1 cursor-pointer hover:bg-gray-100 transition-colors rounded-full text-xs font-bold flex items-center gap-1 border border-gray-200">
                                        <Smartphone className="w-3 h-3" /> Verify Mobile
                                    </span>
                                )}
                            </div>

                            {/* Profile Completeness */}
                            {(() => {
                                const fields = ['name', 'itsNumber', 'gender', 'dob', 'jamaat', 'education', 'location', 'libasImageUrl', 'fatherName', 'motherName', 'maritalStatus', 'mobile', 'verifiedPhone', 'address', 'professionType'];
                                let filled = 0;
                                fields.forEach(f => { if (myProfile[f] || (f === 'professionType' && myProfile['profession']) || (f === 'education' && myProfile['educationDetails'])) filled++; });
                                let pct = Math.floor((filled / fields.length) * 100);
                                if (myProfile.isCandidateFormComplete) pct = 100;
                                return (
                                    <div id="profile-completeness-section" className="w-full bg-gray-50 p-4 border border-gray-100 rounded-xl flex flex-col items-center">
                                        <div className="w-full flex justify-between text-xs font-bold text-gray-500 mb-2">
                                            <span>Biodata Health</span><span className="text-[#881337]">{pct}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                                            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#881337] transition-all duration-1000" style={{ width: `${pct}%` }} />
                                        </div>

                                        {/* --- INTERACTIVE TO-DO LIST --- */}
                                        <div className="w-full space-y-2 mb-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 mb-1">Onboarding To-Do</p>

                                            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${myProfile.isCandidateFormComplete ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-gray-100 text-gray-700'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${myProfile.isCandidateFormComplete ? 'bg-emerald-500 text-white' : 'border-2 border-gray-200'}`}>
                                                        {myProfile.isCandidateFormComplete && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs font-bold">Registration Form</span>
                                                </div>
                                                {!myProfile.isCandidateFormComplete && <ArrowRight className="w-3.5 h-3.5 text-gray-300" />}
                                            </div>

                                            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${user?.emailVerified || myProfile.isEmailVerified ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-gray-100 text-gray-700'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${user?.emailVerified || myProfile.isEmailVerified ? 'bg-emerald-500 text-white' : 'border-2 border-gray-200'}`}>
                                                        {(user?.emailVerified || myProfile.isEmailVerified) && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs font-bold">Email Verification</span>
                                                </div>
                                                {!(user?.emailVerified || myProfile.isEmailVerified) && <ArrowRight className="w-3.5 h-3.5 text-gray-300" />}
                                            </div>

                                            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${myProfile.verifiedPhone ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-gray-100 text-gray-700'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${myProfile.verifiedPhone ? 'bg-emerald-500 text-white' : 'border-2 border-gray-200'}`}>
                                                        {myProfile.verifiedPhone && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs font-bold">Mobile Verification</span>
                                                </div>
                                                {!myProfile.verifiedPhone && <button onClick={() => setShowMobileVerifyModal(true)} className="text-[9px] font-black uppercase bg-[#881337] text-white px-2 py-1 rounded-lg">Verify Now</button>}
                                            </div>

                                            <div className={`p-3 rounded-xl border flex items-center justify-between transition-all ${myProfile.libasImageUrl ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-white border-gray-100 text-gray-700'}`}>
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${myProfile.libasImageUrl ? 'bg-emerald-500 text-white' : 'border-2 border-gray-200'}`}>
                                                        {myProfile.libasImageUrl && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs font-bold">Upload Photos</span>
                                                </div>
                                                {!myProfile.libasImageUrl && <ArrowRight className="w-3.5 h-3.5 text-gray-300" />}
                                            </div>

                                            {/* Selfie Verification Item */}
                                            <div
                                                id="selfie-verification-row"
                                                onClick={() => {
                                                    if (!myProfile.isPhotoVerified && myProfile.selfieStatus !== "pending") {
                                                        setShowSelfieModal(true);
                                                    }
                                                }}
                                                className={`p-3 rounded-xl border flex items-center justify-between transition-all ${myProfile.isPhotoVerified ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-white border-gray-100 text-gray-700'} ${(!myProfile.isPhotoVerified && myProfile.selfieStatus !== "pending") ? "cursor-pointer hover:bg-gray-50 active:scale-[0.98]" : ""}`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${myProfile.isPhotoVerified ? 'bg-blue-500 text-white' : myProfile.selfieStatus === 'pending' ? 'bg-amber-500 text-white' : 'border-2 border-gray-200'}`}>
                                                        {myProfile.isPhotoVerified ? <ShieldCheck className="w-3 h-3" /> : myProfile.selfieStatus === 'pending' ? <Clock className="w-3 h-3" /> : null}
                                                    </div>
                                                    <span className="text-xs font-bold">Selfie Verification {myProfile.selfieStatus === 'pending' && <span className="text-[9px] font-black uppercase text-amber-600 block leading-none mt-0.5">Under Review</span>}</span>
                                                </div>
                                                {!myProfile.isPhotoVerified && myProfile.selfieStatus !== 'pending' && (
                                                    <button className="text-[10px] font-black bg-[#881337] text-white px-2 py-1 rounded-lg">Get Verified</button>
                                                )}
                                            </div>
                                        </div>

                                        {pct < 100 && (
                                            <button onClick={() => router.push('/candidate-registration')} className="w-full bg-[#881337] text-white py-2.5 rounded-xl text-sm font-bold shadow hover:bg-[#9F1239] transition-all mt-1">Enhance Your Biodata</button>
                                        )}
                                        {pct >= 100 && !myProfile.isItsVerified && (
                                            <div className="w-full bg-yellow-50 text-yellow-700 py-2 rounded-lg text-xs font-bold text-center border border-yellow-200 mt-1">ITS Verification Pending — you can still browse</div>
                                        )}
                                        <button
                                            onClick={() => setShowMyProfileModal(true)}
                                            className="w-full bg-white text-[#881337] border border-[#881337]/20 hover:bg-rose-50 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all mt-3 flex items-center justify-center gap-1"
                                        >
                                            <Sparkles className="w-3.5 h-3.5" /> Preview My Public Biodata
                                        </button>
                                         <button
                                            onClick={() => router.push('/candidate-registration')}
                                            className="w-full bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all mt-2 flex items-center justify-center gap-1"
                                        >
                                            ✏️ Edit My Biodata
                                        </button>

                                        {myProfile.status === 'verified' && (
                                            <button
                                                id="download-biodata-btn"
                                                onClick={handleDownloadBiodata}
                                                disabled={generatingBiodata}
                                                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all mt-6 flex items-center justify-center gap-2 group"
                                            >
                                                {generatingBiodata ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                                                Download Digital Biodata
                                            </button>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* 🖼️ HIDDEN BIODATA TEMPLATE FOR EXPORT */}
                        <div className="fixed left-[-9999px] top-0">
                            <div 
                                ref={biodataRef}
                                className="w-[750px] p-10 relative overflow-hidden"
                                style={{ 
                                    fontFamily: 'serif', 
                                    backgroundColor: '#ffffff',
                                    color: '#1a1a1a'
                                }}
                            >
                                {/* Premium Border Overlay */}
                                <div className="absolute inset-0 border-[15px]" style={{ borderColor: '#881337' }} />
                                <div className="absolute inset-[20px] border-2" style={{ borderColor: '#D4AF37' }} />

                                 {/* URL Branding at Top */}
                                 <div className="absolute top-4 left-0 right-0 text-center text-[8px] font-black uppercase tracking-[0.5em]" style={{ color: 'rgba(136, 19, 55, 0.3)' }}>
                                     https://53dbohrarishta.in
                                 </div>

                                 {/* Header section (Matching Login Branding) */}
                                 <div className="text-center mb-10 mt-10 relative z-10">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full font-bold text-3xl" 
                                         style={{ 
                                            color: '#D4AF37', 
                                            border: '2px solid #D4AF37',
                                            backgroundColor: '#ffffff',
                                            boxShadow: '0 0 0 4px rgba(255,255,255,0.2), 0 0 30px rgba(212,175,55,0.5)'
                                         }}>
                                        53
                                    </div>
                                    <h1 className="text-4xl font-extrabold tracking-tight mb-1" style={{ color: '#881337', fontFamily: 'serif' }}>
                                        DBohra<span style={{ color: '#D4AF37', fontWeight: 'normal', fontStyle: 'italic' }}>Rishta</span>
                                    </h1>
                                    <div className="flex items-center justify-center gap-2 mt-2">
                                        <div className="h-[1px] w-8" style={{ backgroundColor: 'rgba(136, 19, 55, 0.2)' }} />
                                        <p className="text-[10px] font-sans font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(136, 19, 55, 0.6)' }}>Intelligent Matches</p>
                                        <div className="h-[1px] w-8" style={{ backgroundColor: 'rgba(136, 19, 55, 0.2)' }} />
                                    </div>
                                </div>

                                <div className="flex gap-10 mb-8 relative z-10 px-4">
                                    {/* Left: Photo & Verification */}
                                    <div className="w-56 shrink-0">
                                        <div className="w-56 h-72 rounded-2xl overflow-hidden mb-4" style={{ border: '4px solid #ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                                            {myProfile.libasImageUrl ? (
                                                <img src={myProfile.libasImageUrl} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#f3f4f6', color: '#d1d5db' }}>
                                                    <User size={80} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <div className="px-3 py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: '#fff1f2', color: '#881337', border: '1px solid #ffe4e6', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>{myProfile.gender} Member</div>
                                            <div className="px-3 py-2 rounded-xl text-center text-[10px] font-black uppercase tracking-wider" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>ITS Verified Member</div>
                                        </div>
                                    </div>

                                    {/* Right: Essential Profile Details */}
                                    <div className="flex-1 pt-2">
                                        <h2 className="text-4xl font-black mb-6" style={{ color: '#111827', lineHeight: 1 }}>{myProfile.name}</h2>
                                        
                                        <div className="space-y-6 font-sans">
                                            {/* Contact Card */}
                                            <div className="p-5 rounded-2xl border" style={{ backgroundColor: '#fcf8f9', borderColor: '#f5e6e9', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                                                <div className="grid grid-cols-1 gap-y-3">
                                                    <div className="flex items-center gap-3">
                                                        <div style={{ color: '#881337' }}><Phone size={16} /></div> 
                                                        <span className="text-sm font-bold">{myProfile.mobileCode} {myProfile.mobile}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div style={{ color: '#881337' }}><Mail size={16} /></div> 
                                                        <span className="text-sm font-bold">{myProfile.email}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Primary Stats */}
                                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                                <div className="flex flex-col border-l-2 pl-3" style={{ borderLeftColor: '#D4AF37' }}><span className="text-[9px] font-black uppercase mb-0.5" style={{ color: '#9ca3af' }}>Age / DOB</span><span className="font-bold" style={{ color: '#1f2937' }}>{myProfile.dob ? `${new Date().getFullYear() - new Date(myProfile.dob).getFullYear()} Years` : 'N/A'}</span></div>
                                                <div className="flex flex-col border-l-2 pl-3" style={{ borderLeftColor: '#D4AF37' }}><span className="text-[9px] font-black uppercase mb-0.5" style={{ color: '#9ca3af' }}>Height</span><span className="font-bold" style={{ color: '#1f2937' }}>{myProfile.heightFeet}'{myProfile.heightInch}"</span></div>
                                                 <div className="flex flex-col border-l-2 pl-3" style={{ borderLeftColor: '#D4AF37' }}><span className="text-[9px] font-black uppercase mb-0.5" style={{ color: '#9ca3af' }}>Education</span><span className="font-bold leading-normal text-xs" style={{ color: '#1f2937' }}>{myProfile.education}</span></div>
                                                <div className="flex flex-col border-l-2 pl-3" style={{ borderLeftColor: '#D4AF37' }}><span className="text-[9px] font-black uppercase mb-0.5" style={{ color: '#9ca3af' }}>Marital Status</span><span className="font-bold text-xs" style={{ color: '#1f2937' }}>{myProfile.maritalStatus || 'Single'}</span></div>
                                            </div>

                                            <div className="flex flex-col border-l-2 pl-3" style={{ borderLeftColor: '#D4AF37' }}>
                                                <span className="text-[9px] font-black uppercase mb-0.5" style={{ color: '#9ca3af' }}>Location</span>
                                                <span className="text-sm font-bold" style={{ color: '#1f2937' }}>{myProfile.location || myProfile.hizratLocation || myProfile.city}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Information Sections */}
                                <div className="grid grid-cols-2 gap-10 relative z-10 mb-8 px-4">
                                    <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 pb-1" style={{ color: '#881337', borderBottom: '2px solid #D4AF37' }}>Family Background</h3>
                                        <div className="space-y-2 text-sm" style={{ color: '#374151' }}>
                                            <div className="flex justify-between pb-1" style={{ borderBottom: '1px solid #f3f4f6' }}><span>Father</span><span className="font-bold">{myProfile.fatherName || 'Not Shared'}</span></div>
                                            <div className="flex justify-between pb-1" style={{ borderBottom: '1px solid #f3f4f6' }}><span>Mother</span><span className="font-bold">{myProfile.motherName || 'Not Shared'}</span></div>
                                            <div className="flex justify-between pb-1" style={{ borderBottom: '1px solid #f3f4f6' }}><span>Jamaat</span><span className="font-bold">{myProfile.jamaat || 'N/A'}</span></div>
                                            <div className="flex justify-between pb-1" style={{ borderBottom: '1px solid #f3f4f6' }}><span>Watan</span><span className="font-bold">{myProfile.ancestralWatan || 'N/A'}</span></div>
                                        </div>
                                    </div>

                                     <div>
                                        <h3 className="text-[11px] font-black uppercase tracking-widest mb-3 pb-1" style={{ color: '#881337', borderBottom: '2px solid #D4AF37' }}>About Me</h3>
                                        <p className="text-xs leading-relaxed italic" style={{ color: '#4b5563' }}>
                                            {myProfile.bio || "Seeking a companion based on deen and traditional values. Looking forward to connecting with a compatible match. Ameen."}
                                        </p>
                                    </div>
                                </div>

                                {/* QR & Footer Section */}
                                <div className="pt-8 border-t relative z-10 flex items-start justify-between px-4" style={{ borderTop: '1px solid #f3f4f6' }}>
                                    <div className="flex-1 pr-10">
                                        <p className="text-[10px] font-bold mb-2" style={{ color: '#881337' }}>Verified via 53DBohraRishta Online Community</p>
                                        <p className="text-[8px] leading-relaxed mb-4" style={{ color: '#9ca3af' }}>
                                            <strong>Note:</strong> 53dbohrarishta.in is a community platform and is <strong>NOT RESPONSIBLE</strong> for the accuracy of information shared in this profile or <strong>ANY MISUSE</strong> of this biodata by any third party. Users are advised to perform their own independent verification before proceeding.
                                        </p>
                                        <p className="text-[9px] font-bold" style={{ color: '#374151' }}>
                                            Verification ID: {myProfile.itsNumber?.substring(0, 4)}XXXXX
                                        </p>
                                    </div>
                                    
                                    <div 
                                        className="flex flex-col items-center gap-2 p-3 rounded-2xl border" 
                                        style={{ backgroundColor: '#f9fafb', borderColor: '#f3f4f6', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}
                                    >
                                        <div className="p-1 rounded bg-white" style={{ boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
                                            <QRCodeCanvas value={`https://53dbohrarishta.in/profile?id=${myProfile.id || user?.uid}`} size={100} />
                                        </div>
                                        <p className="text-[8px] font-black uppercase mt-1" style={{ color: '#881337' }}>Scan to Verify</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Who Viewed My Profile ── */}
                        <div className="mt-4 bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-rose-50 flex items-center justify-center">
                                        <Eye className="w-3.5 h-3.5 text-[#881337]" />
                                    </div>
                                    <h3 className="text-xs font-black text-[#881337] uppercase tracking-wider">Who Viewed My Profile</h3>
                                </div>
                                {recentViews.length > 0 && (
                                    <span className="text-[9px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full uppercase border border-gray-100">{recentViews.length} recent</span>
                                )}
                            </div>
                            {recentViews.length === 0 ? (
                                <div className="flex flex-col items-center py-6 text-center">
                                    <div className="w-12 h-12 rounded-full bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center mb-2">
                                        <Eye className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <p className="text-xs font-bold text-gray-400">No profile views yet</p>
                                    <p className="text-[10px] text-gray-300 mt-0.5">When someone views your biodata, they&apos;ll appear here</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {recentViews.map((visitor) => {
                                        const viewedAt = visitor.timestamp?.seconds
                                            ? new Date(visitor.timestamp.seconds * 1000)
                                            : visitor.timestamp ? new Date(visitor.timestamp) : null;
                                        const diffMs = viewedAt ? Date.now() - viewedAt.getTime() : 0;
                                        const diffMins = Math.floor(diffMs / 60000);
                                        const timeAgo = diffMins < 1 ? 'just now'
                                            : diffMins < 60 ? `${diffMins}m ago`
                                                : diffMins < 1440 ? `${Math.floor(diffMins / 60)}h ago`
                                                    : viewedAt ? viewedAt.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
                                        return (
                                            <div
                                                key={visitor.id}
                                                onClick={() => router.push(`/profile?id=${visitor.viewerId}`)}
                                                className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-rose-50/40 cursor-pointer group border border-transparent hover:border-rose-100 transition-all"
                                            >
                                                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                                    {visitor.viewerLibasUrl ? (
                                                        <img src={visitor.viewerLibasUrl} alt={visitor.viewerName} className="w-full h-full object-cover blur-sm group-hover:blur-0 grayscale group-hover:grayscale-0 transition-all" />
                                                    ) : (
                                                        <div className="w-full h-full bg-rose-50 flex items-center justify-center text-[#881337] font-black text-sm">
                                                            {visitor.viewerName?.[0] || '?'}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm text-gray-800 truncate group-hover:text-[#881337] transition-colors">{visitor.viewerName || 'Anonymous'}</p>
                                                    <p className="text-[10px] text-gray-400 truncate">{visitor.viewerLocation || visitor.viewerJamaat || ''}</p>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full border border-gray-100">{timeAgo}</span>
                                                    <ArrowRight className="w-3 h-3 text-gray-300 group-hover:text-[#881337] transition-colors" />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* NOTIFICATIONS TAB */}
                {activeTab === 'notifications' && (
                    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                        <h2 className="text-lg font-black text-[#881337] uppercase tracking-widest mb-2 flex items-center justify-between">
                            <span>🔔 Notifications</span>
                            {notifications.length > 0 && <span className="text-[10px] bg-rose-50 text-[#881337] px-2 py-0.5 rounded-full lowercase tracking-normal">showing latest {notifications.length}</span>}
                        </h2>

                        {/* Special Status Notifications */}
                        {showVerifiedCelebration && (
                            <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">✨</div>
                                <div className="text-3xl animate-bounce shrink-0">🎊</div>
                                <div className="flex-1">
                                    <p className="font-black text-emerald-800 text-base">Mubarak! Your Profile is Successfully Verified ✨</p>
                                    <p className="text-emerald-700 text-sm mt-1 leading-relaxed">You can now send Rishta requests and access all the amazing features. May Allah bless you and help you find your Soulmate soon. <strong>Shukran! 🤲</strong></p>
                                    <button onClick={() => { setActiveTab('discovery'); setShowVerifiedCelebration(false); }} className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md active:scale-95">🌟 Start Discovering</button>
                                </div>
                            </div>
                        )}

                        {/* List dynamic notifications */}
                        {notifications.length > 0 ? (
                            <div className="space-y-3">
                                {notifications.map((n) => (
                                    <div key={n.id} className={`p-4 rounded-2xl border transition-all flex gap-3 items-start relative group ${n.isRead ? 'bg-white border-gray-100' : 'bg-rose-50/30 border-rose-100 shadow-sm ring-1 ring-rose-200/50'}`}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                                            className="absolute top-3 right-3 p-1 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Dismiss"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>

                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0 border border-gray-100 mt-0.5">
                                            {n.type === 'admin_message' && <MessageCircle className="w-5 h-5 text-[#881337]" />}
                                            {n.type === 'request_accepted' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
                                            {n.type === 'request_declined' && <X className="w-5 h-5 text-rose-500" />}
                                            {n.type === 'status_update' && <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />}
                                        </div>
                                        <div className="flex-1 pr-6">
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                                <p className="text-xs font-black text-[#881337] uppercase tracking-wider">{n.title || n.type.replace('_', ' ')}</p>
                                                <p className="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                                                    {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'just now'}
                                                </p>
                                            </div>
                                            <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                                                {n.message}
                                            </p>
                                            {n.type === 'admin_message' && (
                                                <button onClick={() => setShowAdminHelpChat(true)} className="mt-2 text-[10px] font-black italic text-[#881337] underline decoration-dotted">View Thread →</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            !showVerifiedCelebration && myProfile?.status !== 'rejected' && myProfile?.status !== 'hold' && (
                                <div className="text-center py-20 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                    <div className="text-5xl mb-3 opacity-20">🔔</div>
                                    <p className="font-bold text-sm text-gray-400">All Caught Up!</p>
                                    <p className="text-xs text-gray-400 mt-1">No new notifications right now.</p>
                                </div>
                            )
                        )}

                        {/* Existing Status alerts as fallbacks if not in notification list */}
                        {myProfile?.status === 'rejected' && (
                            <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl shrink-0">⚠️</div>
                                <div className="flex-1">
                                    <p className="font-black text-[#881337] text-base">Profile Verification Rejected</p>
                                    <p className="text-gray-700 text-sm mt-1">Your biodata verification was rejected. Please reapply with correct data to access the Send Request feature and all other features.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-rose-700 text-sm bg-white border border-rose-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}
                                    <button onClick={() => router.push('/candidate-registration')} className="mt-3 bg-[#881337] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-900 transition-all shadow-md">✏️ Update &amp; Resubmit Profile</button>
                                </div>
                            </div>
                        )}

                        {myProfile?.status === 'hold' && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5 shadow-sm flex gap-4 items-start">
                                <div className="text-3xl shrink-0">⏸️</div>
                                <div className="flex-1">
                                    <p className="font-black text-yellow-800 text-base">Profile On Hold</p>
                                    <p className="text-gray-700 text-sm mt-1">Your profile is temporarily on hold pending admin review.</p>
                                    {myProfile.adminMessage && <p className="mt-2 italic text-yellow-700 text-sm bg-white border border-yellow-100 px-3 py-2 rounded-xl">💬 "{myProfile.adminMessage}"</p>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Discovery / Requests / Messages */}
                {activeTab !== 'mybiodata' && activeTab !== 'notifications' && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {renderTabContent()}
                    </div>
                )}

            </main>


            {/* Mobile Bottom Nav */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 pb-safe flex justify-around items-center z-50 shadow-2xl">
                <button onClick={() => setActiveTab('mybiodata')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'mybiodata' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Biodata</span>
                </button>
                <button onClick={() => setActiveTab('discovery')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'discovery' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <Search className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Search</span>
                </button>
                <button onClick={() => setActiveTab('requests')} className={`flex flex-col items-center gap-0.5 transition-colors ${activeTab === 'requests' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Requests</span>
                </button>
                <button onClick={() => setActiveTab('messages')} className={`flex flex-col items-center gap-0.5 transition-colors relative ${activeTab === 'messages' ? 'text-[#881337]' : 'text-gray-400'}`}>
                    <MessageCircle className="w-5 h-5" /><span className="text-[8px] font-bold uppercase">Accepted (Chat Now)</span>
                    {allRequests.filter(r => r.status === 'accepted' && r.isIncoming).length > 0 && <span className="absolute -top-0.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full" />}
                </button>
            </nav>

            {/* Premium Modal — hidden as premium payments are not active yet */}

            {/* My Profile Preview Modal */}
            {
                showMyProfileModal && myProfile && (() => {
                    const photos = [
                        myProfile.libasImageUrl, 
                        myProfile.extraImageUrl,
                        (myProfile.isPhotoVerified || myProfile.selfieStatus === 'verified' ? myProfile.selfieImageUrl : null)
                    ].filter(Boolean) as string[];
                    const age = myProfile.dob ? Math.floor((Date.now() - new Date(myProfile.dob).getTime()) / 31557600000) : null;
                    const isFemale = myProfile.gender === 'female';
                    // Show how others see it: Blurred surname for females
                    const firstName = myProfile.name?.split(' ')[0] || 'Member';
                    const displayName = isFemale ? `${firstName} ●●●●` : myProfile.name;

                    return (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowMyProfileModal(false)}>
                            <div className="relative bg-[#F9FAFB] w-full max-w-lg h-full sm:h-auto sm:max-h-[85vh] sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>

                                {/* Header Overlay (Mobile Only) */}
                                <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center pointer-events-none">
                                    <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg border border-white/20">
                                        <p className="text-[10px] font-black text-[#881337] uppercase tracking-widest">Public Preview</p>
                                    </div>
                                    <button onClick={() => setShowMyProfileModal(false)} className="w-10 h-10 rounded-full bg-white/90 backdrop-blur shadow-lg flex items-center justify-center text-gray-900 pointer-events-auto active:scale-95 transition-all border border-white/20">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* Content Area */}
                                <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
                                    {/* 1. PHOTO SECTION */}
                                    <div
                                        className="relative h-96 bg-gray-200 cursor-zoom-in group/photo"
                                        onClick={() => setShowPreviewLightbox(true)}
                                    >
                                        {photos[activePreviewPhotoIdx] ? (
                                            <div className="relative w-full h-full overflow-hidden">
                                                {/* Stacked Effect for Multiple Photos */}
                                                {photos.length > 1 && (
                                                    <div className="absolute top-2 right-2 w-full h-full border-4 border-white/20 rounded-3xl translate-x-2 translate-y-2 -z-10 bg-gray-300/50" />
                                                )}

                                                <img
                                                    src={photos[activePreviewPhotoIdx]}
                                                    alt="Profile"
                                                    className={`w-full h-full object-cover transition-all duration-700 group-hover/photo:scale-105 ${isFemale && myProfile.isBlurSecurityEnabled !== false ? 'blur-[5px] scale-110' : ''}`}
                                                />

                                                {/* Expand Hint */}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover/photo:opacity-100 transition-opacity">
                                                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                                                        <span className="text-white text-xs font-bold uppercase tracking-widest">Click to Expand</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-6xl text-gray-300">👤</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                                        {/* Name Overlay */}
                                        <div className="absolute bottom-6 left-6 right-6">
                                            <h2 className="text-white text-3xl font-black font-serif drop-shadow-lg">
                                                {displayName}{age && `, ${age}`}
                                            </h2>
                                            <div className="bg-[#D4AF37] px-3 py-1 rounded-lg inline-block mt-2 shadow-sm">
                                                <p className="text-white text-[10px] font-black uppercase tracking-widest">
                                                    {myProfile.jamaat || myProfile.city || 'ITS Verified Profile'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Multi-Photo Indicator */}
                                        {photos.length > 1 && (
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-xl z-50">
                                                <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                                                <span>{photos.length} PHOTOS</span>
                                            </div>
                                        )}

                                        {/* Mobile Friendly Navigation Overlays */}
                                        {photos.length > 1 && (
                                            <>
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setActivePreviewPhotoIdx((activePreviewPhotoIdx - 1 + photos.length) % photos.length); }}
                                                    className="absolute left-0 top-0 bottom-0 w-1/2 z-40 cursor-pointer flex items-center justify-start pl-4 group"
                                                >
                                                    <div className="bg-black/20 backdrop-blur-sm p-1.5 rounded-full text-white md:group-hover:opacity-100 transition-opacity">
                                                        <ChevronLeft className="w-5 h-5" />
                                                    </div>
                                                </div>
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setActivePreviewPhotoIdx((activePreviewPhotoIdx + 1) % photos.length); }}
                                                    className="absolute right-0 top-0 bottom-0 w-1/4 z-40 cursor-pointer flex items-center justify-end pr-2 group"
                                                >
                                                    <div className="bg-black/20 backdrop-blur-sm p-1.5 rounded-full text-white md:group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight className="w-5 h-5" />
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* Gallery dots - Mobile Optimized */}
                                        {photos.length > 1 && (
                                            <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-1 z-40">
                                                {photos.map((_, idx) => (
                                                    <div key={idx}
                                                        className={`h-1 rounded-full transition-all duration-300 ${activePreviewPhotoIdx === idx ? 'bg-[#D4AF37] w-6' : 'bg-white/30 w-2'}`} />
                                                ))}
                                            </div>
                                        )}

                                        {/* Verified Badge */}
                                        {myProfile.isItsVerified && (
                                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-gradient-to-r from-[#D4AF37] to-[#B38F00] text-white text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg border border-white/40">
                                                <ShieldCheck className="w-3.5 h-3.5" /> ITS VERIFIED
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. BODY CONTENT */}
                                    <div className="px-6 py-6 space-y-6">
                                        {/* Bio */}
                                        {myProfile.bio && (
                                            <div className="bg-rose-50/50 border-l-4 border-[#881337] p-4 rounded-r-2xl">
                                                <p className="text-sm text-[#881337] font-serif italic leading-relaxed">
                                                    &quot;{myProfile.bio}&quot;
                                                </p>
                                            </div>
                                        )}

                                        {/* Highlights */}
                                        <div className="flex flex-wrap gap-2">
                                            {myProfile.bio?.toLowerCase().includes('hafiz') && (
                                                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] text-white">✨</div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Hafiz</span>
                                                </div>
                                            )}
                                            {(myProfile.city?.toLowerCase().includes('mumbai')) && (
                                                <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full border border-blue-100 flex items-center gap-2">
                                                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white">📍</div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Mumbai Location</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* info grid — exactly matching screenshot */}
                                        <div className="grid grid-cols-2 gap-3 mb-4">
                                            {[
                                                { label: 'Education', value: myProfile.completedUpto || myProfile.education || myProfile.educationDetails },
                                                { label: 'Profession', value: myProfile.professionType },
                                                { label: 'Marital', value: myProfile.maritalStatus || 'Single' },
                                                { label: 'Height', value: myProfile.heightFeet ? `${myProfile.heightFeet}'${myProfile.heightInch || '0'}"` : null },
                                                { label: 'City', value: myProfile.city || myProfile.location || myProfile.hizratLocation },
                                                { label: 'DOB', value: myProfile.dob },
                                            ].filter(d => d.value).map(d => (
                                                <div key={d.label} className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{d.label}</p>
                                                    <p className="text-xs font-bold text-gray-800 truncate">{d.value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Family Info */}
                                        {(myProfile.fatherName || myProfile.motherName || myProfile.siblings || myProfile.noOfChildren || myProfile.citizenOf || myProfile.ancestralWatan) && (
                                            <div className="bg-rose-50/50 rounded-2xl p-4 border border-rose-100/50 space-y-3 mb-4">
                                                <div>
                                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Parents</p>
                                                    <p className="text-xs font-semibold text-gray-600">
                                                        Father: <span className="text-[#881337] font-bold">{myProfile.fatherName || 'N/A'}</span>
                                                        {' '}&nbsp;|&nbsp;{' '}
                                                        Mother: <span className="text-[#881337] font-bold">{myProfile.motherName || 'N/A'}</span>
                                                    </p>
                                                </div>
                                                {(myProfile.siblings || myProfile.noOfChildren) && (
                                                    <div className="grid grid-cols-2 gap-2 border-t border-rose-100/30 pt-3">
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Siblings</p>
                                                            <p className="text-xs font-bold text-gray-800">{myProfile.siblings || '0'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Children</p>
                                                            <p className="text-xs font-bold text-gray-800">{myProfile.noOfChildren || '0'}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {myProfile.citizenOf && (
                                                    <div className="border-t border-rose-100/30 pt-3">
                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Citizen Of</p>
                                                        <p className="text-xs font-bold text-gray-800">{myProfile.citizenOf}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Education Deep Dive */}
                                        {(myProfile.educationDetails || myProfile.hifzStatus) && (
                                            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50 mb-4">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Education & Deeni Taleem</p>
                                                <p className="text-xs text-gray-800 font-bold mb-1">{myProfile.completedUpto || myProfile.education}</p>
                                                {myProfile.educationDetails && <p className="text-xs text-gray-600 leading-relaxed italic">&quot;{myProfile.educationDetails}&quot;</p>}
                                                {myProfile.hifzStatus && (
                                                    <div className="mt-2 inline-block bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold">
                                                        Hifz: {myProfile.hifzStatus}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Occupation Deep Dive */}
                                        {(myProfile.employmentDetails || myProfile.serviceType) && (
                                            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/50 mb-4">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Occupation Details</p>
                                                <p className="text-xs text-gray-800 font-bold mb-1">{myProfile.serviceType || myProfile.professionType}</p>
                                                {myProfile.employmentDetails && <p className="text-xs text-gray-600 leading-relaxed italic">&quot;{myProfile.employmentDetails}&quot;</p>}
                                            </div>
                                        )}

                                        {/* Hobbies */}
                                        {myProfile.hobbies && (
                                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Hobbies & Interests</p>
                                                <p className="text-xs text-gray-700 font-medium">{myProfile.hobbies}</p>
                                            </div>
                                        )}

                                        {/* Partner Qualities */}
                                        {myProfile.partnerQualities && (
                                            <div className="bg-rose-50/30 rounded-2xl p-4 border border-rose-100/50 relative overflow-hidden mb-6">
                                                <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-rose-100/50 rotate-12" />
                                                <p className="text-[9px] font-black text-[#881337] uppercase tracking-widest mb-2">Partner Preferences</p>
                                                <p className="text-xs text-rose-900 italic font-medium leading-relaxed relative z-10">&quot;{myProfile.partnerQualities}&quot;</p>
                                            </div>
                                        )}

                                        {/* Security Notice */}
                                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-4">
                                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                                <Lock className="w-5 h-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-amber-800 uppercase tracking-widest">Privacy Protection Active</p>
                                                <p className="text-[10px] text-amber-700 mt-0.5 leading-relaxed">
                                                    Your **mobile number** and **email address** are hidden. They are only shared automatically when you accept a request.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Close CTA */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur border-t border-gray-100 sm:rounded-b-3xl">
                                    <button
                                        onClick={() => setShowMyProfileModal(false)}
                                        className="w-full bg-[#881337] text-white py-4 rounded-2xl font-black shadow-lg shadow-rose-900/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <X className="w-5 h-5" /> Close Public Preview
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Preview Lightbox (Full View) */}
            {
                showPreviewLightbox && myProfile && (() => {
                    const photos = [myProfile.libasImageUrl, myProfile.extraImageUrl].filter(Boolean) as string[];
                    return (
                        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4" onClick={() => setShowPreviewLightbox(false)}>
                            <button
                                className="absolute top-6 right-6 z-[210] w-12 h-12 bg-white rounded-full flex items-center justify-center text-[#881337] shadow-2xl hover:scale-110 transition-all active:scale-95"
                                onClick={(e) => { e.stopPropagation(); setShowPreviewLightbox(false); }}
                            >
                                <X className="w-6 h-6" />
                            </button>
                            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                                <img src={photos[activePreviewPhotoIdx]} alt="Full View" className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl border border-white/10" />

                                {photos.length > 1 && (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); setActivePreviewPhotoIdx(prev => (prev - 1 + photos.length) % photos.length); }} className="absolute left-2 md:-left-20 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all border border-white/5 shadow-xl">
                                            <ChevronLeft className="w-10 h-10" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setActivePreviewPhotoIdx(prev => (prev + 1) % photos.length); }} className="absolute right-2 md:-right-20 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-all border border-white/5 shadow-xl">
                                            <ChevronRight className="w-10 h-10" />
                                        </button>
                                    </>
                                )}
                                <div className="absolute -bottom-12 left-0 right-0 text-center">
                                    <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.3em] bg-white/5 inline-block px-4 py-2 rounded-full border border-white/10">
                                        Photo {activePreviewPhotoIdx + 1} of {photos.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })()
            }

            {/* Accept Request Modal */}
            {
                acceptingRequest && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
                            <h3 className="text-2xl font-bold font-serif text-[#881337] mb-2">Accept Interest Request</h3>
                            <p className="text-sm text-gray-600 mb-6">Accepting from <span className="font-bold">{acceptingRequest.otherUserName}</span>. Confirm contact details to share.</p>
                            <div className="space-y-4 mb-6">
                                {acceptError && <div className="p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">{acceptError}</div>}
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Mobile Number *</label><input value={acceptMobile} onChange={e => { setAcceptMobile(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. +91 9876543210" /></div>
                                <div><label className="block text-sm font-bold text-gray-700 mb-1">Email Address *</label><input type="email" value={acceptEmail} onChange={e => { setAcceptEmail(e.target.value); setAcceptError(''); }} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. you@example.com" /></div>
                                <div className="flex gap-2 bg-red-50 p-3 rounded-lg border border-red-100">
                                    <Info className="w-4 h-4 text-[#881337] shrink-0 mt-0.5" /><p className="text-xs text-[#881337] font-medium">These details will be shared mutually upon acceptance.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setAcceptingRequest(null)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Cancel</button>
                                <button onClick={confirmAcceptRequest} className="flex-1 py-3 bg-[#D4AF37] text-white font-bold rounded-xl hover:bg-[#c29e2f] shadow-md">Confirm &amp; Accept</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* 🛡️ Selfie Verification Modal */}
            {showSelfieModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-8 shadow-2xl animate-in zoom-in-95 duration-300 border-t-8 border-blue-600">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-2xl font-black text-gray-900 font-serif">Trust Badge</h3>
                            <button onClick={() => setShowSelfieModal(false)} className="p-2 hover:bg-gray-50 rounded-full">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-6">Selfie Verification</p>
                        
                        <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 flex flex-col items-center text-center mb-8">
                            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                                <Camera size={32} />
                            </div>
                            <h4 className="font-black text-sm text-gray-900 mb-2">Upload a Live Selfie</h4>
                            <p className="text-xs text-gray-500 mb-6 italic">Ensure your face is clearly visible. This will be compared with your Libas profile photo for verification. Private & secure.</p>
                            
                            <input 
                                type="file" 
                                ref={selfieInputRef}
                                className="hidden" 
                                accept="image/*"
                                capture="user"
                                onChange={handleSelfieFileChange}
                            />

                            {selfieImageUrl ? (
                                <div className="space-y-4 w-full">
                                    <img src={selfieImageUrl} alt="Selfie preview" className="w-full h-40 object-cover rounded-2xl border border-blue-100" />
                                    <button 
                                        onClick={handleSelfieUpload}
                                        disabled={uploadingSelfie}
                                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {uploadingSelfie ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Submit for Approval"}
                                    </button>
                                    <button onClick={() => { setSelfieImageUrl(null); selfieInputRef.current?.click(); }} className="w-full py-2 text-gray-400 font-black text-[10px] uppercase tracking-widest">
                                        Retake
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => selfieInputRef.current?.click()}
                                    className="w-full py-4 bg-white text-blue-600 rounded-2xl border-2 border-blue-200 border-dashed font-black text-xs uppercase tracking-widest hover:bg-blue-50 transition-all active:scale-95"
                                >
                                    Open Camera
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={() => setShowSelfieModal(false)}
                            className="w-full py-3 text-gray-400 font-black text-[10px] uppercase tracking-widest"
                        >
                            I'll do this later
                        </button>
                    </div>
                </div>
            )}
            {/* Mobile Verification Modal */}
            {showMobileVerifyModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="bg-[#881337] p-6 text-white text-center relative">
                            <button onClick={() => setShowMobileVerifyModal(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                            <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Smartphone className="w-8 h-8 text-[#D4AF37]" />
                            </div>
                            <h3 className="text-xl font-bold font-serif">Verify Mobile Number</h3>
                            <p className="text-white/70 text-[10px] uppercase font-bold tracking-[0.2em] mt-1">Security Verification</p>
                        </div>
                        <div className="p-8">
                            {!mobileVerifyOtpSent ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">My Mobile Number</label>
                                        <input 
                                            type="tel"
                                            value={newMobileVerifyInput}
                                            onChange={(e) => setNewMobileVerifyInput(e.target.value)}
                                            placeholder="+919876543210"
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#881337] outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[11px] text-gray-500 text-center leading-relaxed">
                                        To verify your identity, we'll send a 6-digit code to your registered email: <br/>
                                        <span className="text-[#881337] font-bold">{user?.email}</span>
                                    </p>
                                    <button 
                                        onClick={handleSendMobileVerify}
                                        disabled={mobileVerifyLoading}
                                        className="w-full bg-[#881337] text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {mobileVerifyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4" />}
                                        Send Code to Email
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 text-[11px] font-medium leading-relaxed">
                                        ✅ Code sent! Please check your inbox (and spam folder) for the 6-digit verification code.
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Enter 6-Digit Code</label>
                                        <input 
                                            type="text"
                                            maxLength={6}
                                            value={mobileVerifyOtpCode}
                                            onChange={(e) => setMobileVerifyOtpCode(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-center text-2xl font-black tracking-[0.5em] focus:ring-2 focus:ring-[#881337] outline-none transition-all"
                                            autoFocus
                                        />
                                    </div>
                                    <button 
                                        onClick={handleVerifyMobileVerify}
                                        disabled={mobileVerifyLoading}
                                        className="w-full bg-[#881337] text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {mobileVerifyLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5 text-[#D4AF37]" />}
                                        Verify & Activate
                                    </button>
                                    <button 
                                        onClick={() => setMobileVerifyOtpSent(false)}
                                        className="w-full text-[10px] font-black uppercase text-gray-400 hover:text-[#881337] transition-colors"
                                    >
                                        Change Mobile Number
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 🟢 Floating WhatsApp Share Button */}
            <a
                href={`https://wa.me/?text=${encodeURIComponent(`Salam e Jameel !
I’m using 53DBohraRishta to find genuine, serious matches within our Bohra community. It’s a trusted space built on respect, privacy, and meaningful connections.

السلام علیکم!
હું 53DBohraRishta નો ઉપયોગ કરી રહ્યો છું અમારા બોહરા સમાજમાં ગંભીર અને સાચા સંબંધો શોધવા માટે. આ એક વિશ્વસનીય પ્લેટફોર્મ છે જે ગોપનીયતા, આદર અને અર્થપૂર્ણ જોડાણો પર આધારિત છે.

👉 Join here now: https://www.53dbohrarishta.in/login`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-24 right-6 z-[60] bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all cursor-pointer flex items-center justify-center group animate-pulse"
                title="Share with Community"
            >
                <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.445 0 .062 5.383.06 11.992c0 2.113.553 4.176 1.604 6.003L0 24l6.163-1.617a11.831 11.831 0 005.883 1.565h.004c6.607 0 11.99-5.383 11.992-11.992a11.78 11.78 0 00-3.486-8.452z"/>
                </svg>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                </span>
                <span className="absolute right-full mr-4 bg-gray-900 text-white text-[10px] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl font-bold">Share with Community</span>
            </a>
        </div>
    );
}
