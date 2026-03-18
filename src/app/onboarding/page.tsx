"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, Camera, UploadCloud, CheckCircle2, Loader2, Clock, AlertCircle, LogOut } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { doc, setDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import toast from "react-hot-toast";
import { notifyDuplicateRegistration } from "@/lib/emailService";
import { normalizePhone } from "@/lib/phoneUtils";

export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [loginMethod, setLoginMethod] = useState<string>('');  // 'mobile' | 'google' | ''

    // Data State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        gender: "",
        dob: "",
        itsNumber: "",
        jamaat: "",
        education: "",
        hizratLocation: "",
        bio: "",
        informationProvidedBy: "Myself (Candidate)",
        isBlurSecurityEnabled: true,
    });

    // Pre-fill mobile from sessionStorage if user logged in via phone OTP
    useEffect(() => {
        const verifiedPhone = sessionStorage.getItem('verifiedPhone');
        const method = sessionStorage.getItem('loginMethod');
        if (verifiedPhone) {
            setFormData(prev => ({ ...prev, mobile: verifiedPhone }));
        }
        if (method) {
            setLoginMethod(method);
        }
        // If user logged in via Google, pre-fill their email
        if (user?.email && !user.email.endsWith('@dbohrarishta.local')) {
            setFormData(prev => ({ ...prev, email: prev.email || user.email || '' }));
        }
    }, [user]);

    // Image State
    const [itsImage, setItsImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [libasImage, setLibasImage] = useState<File | null>(null);
    const [libasImagePreview, setLibasImagePreview] = useState<string | null>(null);

    // File Input Ref for Mobile Camera explicitly
    const fileInputRef = useRef<HTMLInputElement>(null);
    const libasFileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        // Clear error when user starts typing
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
        }
    };

    const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error("Image must be less than 5MB");
                return;
            }
            setItsImage(file);
            setImagePreview(URL.createObjectURL(file));
            toast.success("ITS Card captured successfully!");
        }
    };

    const handleLibasImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                toast.error("Image must be less than 5MB");
                return;
            }
            setLibasImage(file);
            setLibasImagePreview(URL.createObjectURL(file));
            toast.success("Profile photo captured successfully!");
        }
    };

    const handleNext = async () => {
        let newErrors: { [key: string]: string } = {};

        if (step === 1) {
            if (!formData.name) newErrors.name = "Full Name is required.";
            if (!formData.email) {
                newErrors.email = "Email is required.";
            } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
                newErrors.email = "Please enter a valid email address.";
            }
            if (!formData.mobile) {
                newErrors.mobile = "Mobile Number is required.";
            } else {
                const normalized = normalizePhone(formData.mobile);
                if (!normalized) {
                    newErrors.mobile = "Invalid number. Use international format e.g. +919876543210";
                } else {
                    // Auto-correct and store normalized number
                    setFormData(prev => ({ ...prev, mobile: normalized }));
                }
            }
            if (!formData.gender) newErrors.gender = "Gender is required.";
            if (!formData.dob) {
                newErrors.dob = "Date of Birth is required.";
            } else {
                const dobDate = new Date(formData.dob);
                const today = new Date();
                const age = today.getFullYear() - dobDate.getFullYear();
                if (age < 18) newErrors.dob = "You must be at least 18 years old.";
                if (age > 80) newErrors.dob = "Please enter a valid date of birth.";
            }

            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }

            setStep(2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const compressImage = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Downscale heavily to fit under Firestore 1MB Limits
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
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); // 50% Quality JPEG
                    resolve(dataUrl);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleSubmit = async () => {
        let newErrors: { [key: string]: string } = {};

        // Validation for combined Step 2 fields
        if (!formData.itsNumber) {
            newErrors.itsNumber = "ITS Number is required.";
        } else if (!/^\d{8}$/.test(formData.itsNumber)) {
            newErrors.itsNumber = "ITS Number must be exactly 8 digits.";
        } else {
            // Check for duplicate ITS Number
            try {
                const { collection, query, where, getDocs } = await import('firebase/firestore');
                const q = query(collection(db, "users"), where("itsNumber", "==", formData.itsNumber));
                const snap = await getDocs(q);
                let isDuplicate = false;
                snap.forEach(d => {
                    if (d.id !== user?.uid) isDuplicate = true;
                });

                if (isDuplicate) {
                    toast.error("This ITS Number is already registered on another profile.");
                    newErrors.itsNumber = "This ITS Number is already in use.";

                    if (formData.email) {
                        notifyDuplicateRegistration({
                            candidateName: formData.name || "User",
                            candidateEmail: formData.email,
                            itsNumber: formData.itsNumber
                        }).catch(err => console.error("Failed to send duplicate notification email:", err));
                    }
                }
            } catch (e) {
                console.error("Duplicate ITS check error:", e);
            }
        }
        if (!formData.jamaat) newErrors.jamaat = "Primary Jamaat is required.";
        if (!itsImage) newErrors.itsImage = "Please upload or capture your ITS card.";
        if (!libasImage) newErrors.libasImage = `Please upload a photo in ${formData.gender === 'female' ? 'Rida' : 'Kurta Saya'}.`;

        if (!formData.education) newErrors.education = "Education details are required.";
        if (!formData.hizratLocation) newErrors.hizratLocation = "Location is required.";
        if (!formData.bio) newErrors.bio = "About me is required.";

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            // Scroll to the first error
            const firstErrorKey = Object.keys(newErrors)[0];
            // Try to find the element by name or ID
            const el = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setLoading(true);
        let itsImageUrl = null;
        let libasImageUrl = null;

        // Fallback ID for testing UI without strict login required
        const userId = user?.uid || `guest_${Date.now()}`;
        const rawPhone = sessionStorage.getItem('verifiedPhone') || formData.mobile;
        // Always normalize phone before saving to DB
        const verifiedPhone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;

        try {
            // 1. Convert Image to Lightweight DataURL String
            if (itsImage) {
                itsImageUrl = await compressImage(itsImage);
            }
            if (libasImage) {
                libasImageUrl = await compressImage(libasImage);
            }

            // 2. Save complete profile to Firestore
            await setDoc(doc(db, "users", userId), {
                ...formData,
                userId: userId,
                itsImageUrl: itsImageUrl || null,
                libasImageUrl: libasImageUrl || null,
                isItsVerified: false,
                isCandidateFormComplete: true,
                status: "pending_verification",
                createdAt: new Date().toISOString(),
                loginMethod: loginMethod || 'google',
                verifiedPhone: verifiedPhone || formData.mobile || null,
                notificationEmail: formData.email || null,
                isOnline: true,
                lastActive: serverTimestamp(),
                isEmailVerified: !!(formData.email && !formData.email.endsWith('@dbohrarishta.local')),
                // Mark welcome email as sent atomically to prevent duplicates
                welcomeEmailSent: !!(formData.email && !formData.email.endsWith('@dbohrarishta.local')),
            });

            // 2b. Automated Admin Welcome Message
            try {
                await addDoc(collection(db, 'admin_messages', userId, 'thread'), {
                    text: `Welcome to 53 DBohraRishta, ${formData.name}! 👋 Your biodata has been submitted and is now in the verification pipeline. Verification typically takes less than 24 hours. In the meantime, you can browse other profiles. If you have any questions, feel free to ask here!`,
                    from: 'admin',
                    createdAt: serverTimestamp(),
                });
            } catch (adminErr) {
                console.warn('Admin welcome message failed:', adminErr);
            }

            // 3. Clear sessionStorage after successful onboarding
            sessionStorage.removeItem('verifiedPhone');
            sessionStorage.removeItem('loginMethod');

            // 4. Send welcome notification — SMS if mobile user, email via standard flow otherwise
            if (loginMethod === 'mobile' && verifiedPhone) {
                // Send SMS welcome since we now have their verified number
                try {
                    await fetch('/api/notify/sms', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: verifiedPhone,
                            message: `Welcome to 53DBohraRishta, ${formData.name}! Your profile is submitted and is pending verification. We'll notify you once approved. JazakAllah!`
                        })
                    });
                } catch (smsError) {
                    console.warn('SMS welcome notification failed:', smsError);
                    // Non-critical: don't block onboarding completion
                }
            }

            // 5. Send ONE welcome email using the real email they just submitted
            // This is the ONLY email a mobile-registered user ever receives before this point
            if (formData.email && !formData.email.endsWith('@dbohrarishta.local')) {
                try {
                    const { notifyWelcomeOnboarding } = await import('@/lib/emailService');
                    await notifyWelcomeOnboarding({
                        candidateName: formData.name,
                        candidateEmail: formData.email,
                    });
                } catch (emailErr) {
                    console.warn('Welcome email failed (non-critical):', emailErr);
                }
            }

            toast.success("Profile Setup Complete! Verification Pending.");
            router.push("/");
        } catch (error: any) {
            console.error("Setup Error", error);
            toast.error(`Error saving profile: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center p-6 text-[#881337] pt-12 pb-24">
            <div className="max-w-xl w-full">

                {/* Logout Button */}
                <div className="flex justify-end mb-4">
                    <button
                        onClick={async () => {
                            sessionStorage.removeItem('verifiedPhone');
                            sessionStorage.removeItem('loginMethod');
                            const { signOut } = await import('firebase/auth');
                            const { auth } = await import('@/lib/firebase/config');
                            await signOut(auth);
                            router.push('/login');
                        }}
                        className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm font-semibold"
                        title="Logout and go back to login"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-10 relative px-4">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-[#D4AF37] -z-10 -translate-y-1/2 rounded-full transition-all duration-300"
                        style={{ width: `${(step - 1) * 100}%` }}
                    ></div>
                    {[1, 2].map((num) => (
                        <div
                            key={num}
                            className={`w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold text-xs border-4 transition-all duration-500 relative ${step >= num ? 'bg-[#881337] text-white border-white shadow-[0_0_15px_rgba(136,19,55,0.3)]' : 'bg-white text-gray-400 border-gray-100'}`}
                        >
                            {num}
                            <span className={`absolute -bottom-6 text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${step === num ? 'text-[#881337]' : 'text-gray-400'}`}>
                                {num === 1 ? 'Basic Info' : 'Details'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Dynamic Form Content */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8">
                    {/* STEP 1: Basic Stats */}
                    {step === 1 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-6">
                                <User className="w-8 h-8 text-[#D4AF37]" />
                                <h2 className="text-2xl font-bold font-serif">Basic Profile</h2>
                            </div>

                            {/* ⏰ Verification Timeline Notice — Step 1 */}
                            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-2">
                                <Clock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs font-black text-blue-700 mb-0.5">Verification Timeline</p>
                                    <p className="text-xs text-blue-600 leading-relaxed">
                                        Once your original ITS photo is uploaded, it will be reviewed <strong>within 24 hours</strong>. After verification, visit your profile again to access all features.
                                    </p>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                                <input name="name" onChange={handleChange} value={formData.name} className={`w-full bg-gray-50 border ${errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} placeholder="e.g. Murtaza Ali" />
                                {errors.name && <p className="text-red-500 text-xs font-bold mt-1">{errors.name}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                                    {/* autoComplete="off" alone isn't enough — additional attributes needed to override browser heuristics */}
                                    <input
                                        type="email"
                                        name="email"
                                        autoComplete="off"
                                        data-lpignore="true"
                                        data-form-type="other"
                                        onChange={handleChange}
                                        value={formData.email}
                                        readOnly={!!user?.email && !user.email.endsWith('@dbohrarishta.local')}
                                        className={`w-full ${!!user?.email && !user.email.endsWith('@dbohrarishta.local') ? 'bg-gray-100 cursor-not-allowed opacity-80' : 'bg-gray-50'} border ${errors.email ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`}
                                        placeholder="Your personal email address"
                                    />
                                    {errors.email && <p className="text-red-500 text-xs font-bold mt-1">{errors.email}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mobile Number</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            name="mobile"
                                            onChange={handleChange}
                                            value={formData.mobile}
                                            readOnly={loginMethod === 'mobile'}
                                            className={`w-full ${loginMethod === 'mobile' ? 'bg-gray-100 cursor-not-allowed' : 'bg-gray-50'} border ${errors.mobile ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`}
                                            placeholder="e.g. +919876543210"
                                        />
                                        {loginMethod === 'mobile' && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                            </div>
                                        )}
                                    </div>
                                    {errors.mobile && <p className="text-red-500 text-xs font-bold mt-1">{errors.mobile}</p>}
                                    {loginMethod === 'mobile' ? (
                                        <p className="text-[10px] text-gray-400 mt-1 font-bold italic">✓ Verified via OTP</p>
                                    ) : (
                                        <p className="text-[10px] text-gray-500 mt-1 font-medium italic">Please include +91 or your country code</p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                                    <select name="gender" onChange={handleChange} value={formData.gender} className={`w-full bg-gray-50 border ${errors.gender ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`}>
                                        <option value="">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                    {errors.gender && <p className="text-red-500 text-xs font-bold mt-1">{errors.gender}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                    <input type="date" name="dob" max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]} onChange={handleChange} value={formData.dob} className={`w-full bg-gray-50 border ${errors.dob ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} />
                                    {errors.dob && <p className="text-red-500 text-xs font-bold mt-1">{errors.dob}</p>}
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={handleNext} className="bg-[#881337] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#9F1239] transition-colors shadow-md">Next</button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Verification Camera */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-4">
                                <ShieldCheck className="w-8 h-8 text-[#D4AF37]" />
                                <h2 className="text-2xl font-bold font-serif">Identity & Community</h2>
                            </div>

                            {/* Verification Notice - Highlight 1 moved from Step 3 */}
                            <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-400 rounded-xl flex gap-3 items-start shadow-sm animate-in fade-in slide-in-from-left-4 duration-500">
                                <span className="text-2xl shrink-0">⏳</span>
                                <div>
                                    <p className="text-sm font-black text-amber-800 mb-1">Important: Verification Process</p>
                                    <p className="text-sm text-amber-700 font-medium leading-relaxed">
                                        Once your <strong>original ITS photo</strong> is uploaded, it will be reviewed <strong>on or before 24 hours</strong>.
                                        After verification, visit your profile again to <strong>access all features</strong>.
                                    </p>
                                </div>
                            </div>



                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3 text-sm text-yellow-800 mb-2">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <p>Verify your ITS Card to secure 'Verified' badges and unlock access to private unblurred photos.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">ITS Number</label>
                                <input name="itsNumber" onChange={handleChange} value={formData.itsNumber} className={`w-full bg-gray-50 border ${errors.itsNumber ? 'border-red-500 focus:ring-red-500' : 'border-yellow-400 focus:ring-yellow-500'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} placeholder="e.g. 2045612" />
                                {errors.itsNumber && <p className="text-red-500 text-xs font-bold mt-1">{errors.itsNumber}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Primary Jamaat</label>
                                <input name="jamaat" onChange={handleChange} value={formData.jamaat} className={`w-full bg-gray-50 border ${errors.jamaat ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} placeholder="e.g. Husaini Jamaat, London" />
                                {errors.jamaat && <p className="text-red-500 text-xs font-bold mt-1">{errors.jamaat}</p>}
                            </div>

                            {/* Mobile Real-time Camera Capture for ITS */}
                            <div id="itsImage" className={`mt-6 border-2 border-yellow-400 rounded-xl p-5 bg-yellow-50/30 shadow-sm flex flex-col items-center relative overflow-hidden`}>
                                <div className="absolute top-0 left-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-black uppercase tracking-widest text-center py-1">
                                    Strictly Confidential & Mandatory
                                </div>
                                <label className="text-center w-full block mt-4 mb-2 font-bold text-sm text-[#881337]">
                                    Upload Your Original ITS Card Photo
                                </label>
                                <p className="text-xs text-yellow-800 text-center mb-5 max-w-sm font-medium leading-relaxed">
                                    Your profile <strong className="text-red-600">will be rejected</strong> if the ITS card photo is entirely missing or fake. This is strictly required to verify your identity before allowing access to the platform. <strong>Only Verified ITS card candidates can send requests. Request option will be locked until verification.</strong>
                                </p>

                                {imagePreview ? (
                                    <div className="relative w-full max-w-[250px] aspect-[1.58] rounded-xl overflow-hidden shadow-lg border-2 border-[#D4AF37]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={imagePreview} alt="ITS Capture" className="object-cover w-full h-full" />
                                        <button
                                            onClick={() => { setItsImage(null); setImagePreview(null); }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
                                        >
                                            Retake
                                        </button>
                                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md rounded-lg p-2 flex items-center justify-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                                            <span className="text-white text-xs font-bold">Image Locked</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex gap-3">
                                        {/* Hidden Native File Input supporting Mobile Cameras via capture="environment" */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={handleImageCapture}
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1 border-2 border-dashed border-[#881337] bg-rose-50 text-[#881337] hover:bg-rose-100 transition-colors py-4 rounded-xl flex flex-col items-center justify-center gap-2"
                                        >
                                            <Camera className="w-6 h-6" />
                                            <span className="text-sm font-bold">Open Camera</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                // Trick to only open file gallery by removing the capture explicit tag strictly for this click, or using another ref. 
                                                // Simplest way is to just use a standard file input without capture:
                                                const el = document.createElement("input");
                                                el.setAttribute("type", "file");
                                                el.setAttribute("accept", "image/*");
                                                el.onchange = (e: any) => handleImageCapture(e);
                                                el.click();
                                            }}
                                            className="flex-1 border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors py-4 rounded-xl flex flex-col items-center justify-center gap-2"
                                        >
                                            <UploadCloud className="w-6 h-6" />
                                            <span className="text-sm font-bold">Upload Gallery</span>
                                        </button>
                                    </div>
                                )}
                                {errors.itsImage && <p className="text-red-500 text-xs font-bold mt-2 w-full text-center">{errors.itsImage}</p>}
                            </div>

                            {/* Qaumi Libas Photo Upload */}
                            <div id="libasImage" className={`mt-6 border ${errors.libasImage ? 'border-red-500' : 'border-gray-200'} rounded-xl p-5 bg-white shadow-sm flex flex-col items-center`}>
                                <label className="text-center w-full block mb-2 font-bold text-sm text-[#881337]">
                                    Upload Profile Photo (Prefer {formData.gender === 'female' ? 'Rida' : 'Saya Kurta'})
                                </label>
                                <p className="text-[10px] text-gray-400 text-center mb-4 italic font-medium">
                                    Note: You can upload additional normal photos from your profile section after completing onboarding.
                                </p>

                                {libasImagePreview ? (
                                    <div className="relative w-full max-w-[250px] aspect-[1] rounded-xl overflow-hidden shadow-lg border-2 border-[#D4AF37]">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={libasImagePreview} alt="Libas Capture" className="object-cover w-full h-full" />
                                        <button
                                            onClick={() => { setLibasImage(null); setLibasImagePreview(null); }}
                                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
                                        >
                                            Retake
                                        </button>
                                        <div className="absolute bottom-2 left-2 right-2 bg-black/60 backdrop-blur-md rounded-lg p-2 flex items-center justify-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-[#D4AF37]" />
                                            <span className="text-white text-xs font-bold">Image Locked</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full flex gap-3">
                                        {/* Hidden Native File Input supporting Mobile Cameras via capture="environment" */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            ref={libasFileInputRef}
                                            className="hidden"
                                            onChange={handleLibasImageCapture}
                                        />
                                        <button
                                            onClick={() => libasFileInputRef.current?.click()}
                                            className="flex-1 border-2 border-dashed border-[#881337] bg-rose-50 text-[#881337] hover:bg-rose-100 transition-colors py-4 rounded-xl flex flex-col items-center justify-center gap-2"
                                        >
                                            <Camera className="w-6 h-6" />
                                            <span className="text-sm font-bold">Open Camera</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                const el = document.createElement("input");
                                                el.setAttribute("type", "file");
                                                el.setAttribute("accept", "image/*");
                                                el.onchange = (e: any) => handleLibasImageCapture(e);
                                                el.click();
                                            }}
                                            className="flex-1 border border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors py-4 rounded-xl flex flex-col items-center justify-center gap-2"
                                        >
                                            <UploadCloud className="w-6 h-6" />
                                            <span className="text-sm font-bold">Upload Gallery</span>
                                        </button>
                                    </div>
                                )}
                                {errors.libasImage && <p className="text-red-500 text-xs font-bold mt-2 w-full text-center">{errors.libasImage}</p>}
                            </div>

                            {/* STEP 3 CONTENT MERGED HERE */}
                            <div className="space-y-5 pt-4 border-t border-gray-100">
                                <div className="flex items-start flex-col mb-2">
                                    <h2 className="text-xl font-bold font-serif mb-1">Dunyawi Details</h2>
                                    <p className="text-xs text-gray-500">Education and current Hizrat (Location) preferences.</p>
                                </div>

                                {/* Guardian Mode */}
                                <div className="bg-rose-50 p-5 rounded-2xl border-2 border-rose-100 shadow-sm">
                                    <label className="block text-sm font-black text-[#881337] mb-2 uppercase tracking-tight">Rishta Guardian Mode</label>
                                    <p className="text-xs text-gray-500 mb-4 leading-relaxed font-medium">Is this profile managed by the candidate themselves or a Parent/Guardian?</p>
                                    <select
                                        name="informationProvidedBy"
                                        onChange={handleChange}
                                        value={formData.informationProvidedBy}
                                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-3.5 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#881337] outline-none shadow-inner"
                                    >
                                        <option value="Myself (Candidate)">Managed by Candidate (Self)</option>
                                        <option value="Parent/Guardian (Wali)">Managed by Parent/Guardian (Wali Mode)</option>
                                        <option value="Sibling">Managed by Sibling</option>
                                        <option value="Friend/Relative">Managed by Friend/Relative</option>
                                    </select>
                                </div>

                                {/* Privacy Toggle */}
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-gray-800 mb-1 uppercase tracking-tight">Photo Privacy Control</p>
                                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                                            Enable <strong>Blur Mode</strong> for extra security. Photos only unblur for accepted requests.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, isBlurSecurityEnabled: !p.isBlurSecurityEnabled }))}
                                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.isBlurSecurityEnabled ? 'bg-[#881337]' : 'bg-gray-300'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.isBlurSecurityEnabled ? 'right-1' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Highest Education</label>
                                    <input name="education" onChange={handleChange} value={formData.education} className={`w-full bg-gray-50 border ${errors.education ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} placeholder="e.g. MBA in Finance" />
                                    {errors.education && <p className="text-red-500 text-xs font-bold mt-1">{errors.education}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Current Location</label>
                                    <input name="hizratLocation" onChange={handleChange} value={formData.hizratLocation} className={`w-full bg-gray-50 border ${errors.hizratLocation ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2`} placeholder="e.g. Dubai, UAE" />
                                    {errors.hizratLocation && <p className="text-red-500 text-xs font-bold mt-1">{errors.hizratLocation}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Bio (Be Intentional)</label>
                                    <textarea name="bio" onChange={handleChange} value={formData.bio} rows={4} className={`w-full bg-gray-50 border ${errors.bio ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:outline-none focus:ring-2 resize-none`} placeholder="Share your expectations for an alliance..." />
                                    {errors.bio && <p className="text-red-500 text-xs font-bold mt-1">{errors.bio}</p>}
                                </div> 
                            </div>

                            <div className="flex justify-between pt-6">
                                <button onClick={() => setStep(1)} className="text-gray-500 px-6 py-3 font-bold hover:text-gray-700" disabled={loading}>Back</button>
                                <button 
                                    onClick={handleSubmit} 
                                    disabled={loading}
                                    className="bg-[#D4AF37] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#c29e2f] transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {loading ? "Saving to Cloud..." : "Complete Setup"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
