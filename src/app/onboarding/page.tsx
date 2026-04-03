"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, Camera, UploadCloud, CheckCircle2, Loader2, Clock, AlertCircle, LogOut, Info } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import toast from "react-hot-toast";
import { notifyDuplicateRegistration, notifyAdminNewRegistration, notifyWelcomeOnboarding } from "@/lib/emailService";
import { normalizePhone } from "@/lib/phoneUtils";

export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [isMounted, setIsMounted] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [loginMethod, setLoginMethod] = useState<string>('');  // 'mobile' | 'google' | ''

    // Data State
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "91",
        gender: "",
        dob: "",
        itsNumber: "",
        jamaat: "",
        education: "",
        location: "",
        bio: "",
        heightFeet: "",
        heightInch: "",
        maritalStatus: "Single",
        fatherName: "",
        motherName: "",
        ancestralWatan: "",
        professionType: "",
        informationProvidedBy: "Myself (Candidate)",
        isBlurSecurityEnabled: true,
    });

    // Pre-fill from Firestore if user has partial data, or from sessionStorage
    useEffect(() => {
        const loadInitialData = async () => {
            if (!user) return;

            setLoading(true);
            try {
                // 1. Try fetching from Firestore first (for users returning from follow-up email)
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    
                    // Redirect if already complete
                    if (data.isCandidateFormComplete) {
                        router.push("/");
                        return;
                    }
                    
                    setFormData(prev => ({
                        ...prev,
                        ...data,
                        // Ensure internal email doesn't overwrite if they just logged in with Google
                        email: (data.email && !data.email.endsWith('@dbohrarishta.local')) ? data.email : prev.email
                    }));
                    if (data.loginMethod) setLoginMethod(data.loginMethod);
                }

                // 2. Fallback/Supplement with sessionStorage (for fresh OTP logins)
                const verifiedPhone = sessionStorage.getItem('verifiedPhone');
                const method = sessionStorage.getItem('loginMethod');
                
                if (verifiedPhone) {
                    setFormData(prev => ({ ...prev, mobile: verifiedPhone.replace(/\D/g, '') }));
                } else if (!formData.mobile || formData.mobile === "91" || formData.mobile === "+91 ") {
                    setFormData(prev => ({ ...prev, mobile: "91" }));
                }
                if (method) {
                    setLoginMethod(prev => prev || method);
                }

                // 3. Google Auth pre-fill
                if (user?.email && !user.email.endsWith('@dbohrarishta.local')) {
                    setFormData(prev => ({ ...prev, email: prev.email || user.email || '' }));
                }
                if (!formData.name && user?.displayName) {
                    setFormData(prev => ({ ...prev, name: prev.name || user.displayName || '' }));
                }

            } catch (err) {
                console.error("Error loading existing onboarding data:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [user, router]);

    // Image State
    const [itsImage, setItsImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [libasImage, setLibasImage] = useState<File | null>(null);
    const [libasImagePreview, setLibasImagePreview] = useState<string | null>(null);

    // File Input Ref for Mobile Camera explicitly
    const fileInputRef = useRef<HTMLInputElement>(null);
    const libasFileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        
        let newErrorMessage = "";
        if (name === 'bio') {
            if (value.includes('@')) {
                newErrorMessage = "Email addresses are not allowed for security";
            } else {
                const digits = value.replace(/\D/g, '');
                if (digits.length >= 8) {
                    newErrorMessage = "Phone numbers/Contact info not allowed in bio";
                } else {
                    const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
                    const socialPattern = /\b(insta|fb|facebook|instagram|snapchat|snap|telegram|linkedin)\b/i;
                    if (linkPattern.test(value)) {
                        newErrorMessage = "Website links are not allowed in bio";
                    } else if (socialPattern.test(value)) {
                        newErrorMessage = "Social handles/links are not allowed in bio";
                    }
                }
            }
        }

        // Clear existing unrelated errors or show new bio error
        setErrors(prev => ({ 
            ...prev, 
            [name]: newErrorMessage ? newErrorMessage : (prev[name] ? "" : prev[name])
        }));
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
            
            // Mandatory Height Check
            if (!formData.heightFeet) newErrors.heightFeet = "Height is required.";

            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }

            // Persist progress to Firestore
            if (user) {
                try {
                    await setDoc(doc(db, "users", user.uid), {
                        ...formData,
                        userId: user.uid,
                        isCandidateFormComplete: false,
                        updatedAt: serverTimestamp(),
                    }, { merge: true });

                    // Notify Admin that onboarding has started (Pending state)
                    if (formData.email) {
                        notifyAdminNewRegistration({
                            candidateName: formData.name,
                            candidateEmail: formData.email,
                            gender: formData.gender,
                            onboardingStatus: 'pending'
                        }).catch(() => {});
                    }
                } catch (saveErr) {
                    console.warn("Failed to save onboarding progress:", saveErr);
                }
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
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.5); 
                    resolve(dataUrl);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleSubmit = async () => {
        let newErrors: { [key: string]: string } = {};

        // Validation for Step 2 fields
        if (!formData.itsNumber) {
            newErrors.itsNumber = "ITS Number is required.";
        } else if (!/^\d{8}$/.test(formData.itsNumber)) {
            newErrors.itsNumber = "ITS Number must be exactly 8 digits.";
        }
        
        if (!formData.jamaat) newErrors.jamaat = "Primary Jamaat is required.";
        if (!itsImage) newErrors.itsImage = "ITS card photo is mandatory.";
        if (!libasImage) newErrors.libasImage = "Profile photo is mandatory.";
        if (!formData.education) newErrors.education = "Education is required.";
        if (!formData.location) newErrors.location = "Location is required.";
        if (!formData.fatherName) newErrors.fatherName = "Father's name is required.";
        if (!formData.motherName) newErrors.motherName = "Mother's name is required.";
        if (!formData.ancestralWatan) newErrors.ancestralWatan = "Ancestral Watan is required.";

        // --- 🛡️ Contact Leakage Prevention (Bio) ---
        if (formData.bio) {
            if (formData.bio.includes('@')) { 
                newErrors.bio = "Email addresses are not allowed for security";
            } else {
                const digits = formData.bio.replace(/\D/g, '');
                if (digits.length >= 8) { 
                    newErrors.bio = "Phone numbers/Contact info not allowed";
                } else {
                    const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
                    if (linkPattern.test(formData.bio)) { 
                        newErrors.bio = "Website links are not allowed";
                    }
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please fill all mandatory fields.");
            // Scroll to the first error
            const firstErrorKey = Object.keys(newErrors)[0];
            const el = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        setLoading(true);
        let itsImageUrl = null;
        let libasImageUrl = null;

        try {
            // Check for Duplicate ITS Number logic (Requirement: Only one verified profile per ITS)
            if (formData.itsNumber) {
                const usersRef = collection(db, "users");
                const itsQuery = query(usersRef, where("itsNumber", "==", formData.itsNumber));
                const itsSnapshot = await getDocs(itsQuery);

                if (!itsSnapshot.empty) {
                    let isDuplicateFound = false;
                    itsSnapshot.forEach(d => {
                        const data = d.data();
                        // Block if another user already has this ITS and is either verified, approved, or pending
                        if (user && d.id !== user.uid && (data.status === 'verified' || data.status === 'approved' || data.status === 'pending_verification')) {
                            isDuplicateFound = true;
                        }
                    });

                    if (isDuplicateFound) {
                        toast.error(`ITS Number ${formData.itsNumber} is already registered. Only one profile per verified ITS is allowed.`);
                        setLoading(false);
                        // Send automated notification to the user about the duplicate attempt
                        if (formData.email) {
                            notifyDuplicateRegistration({
                                candidateName: formData.name,
                                candidateEmail: formData.email,
                                itsNumber: formData.itsNumber
                            }).catch(() => {});
                        }
                        return;
                    }
                }
            }

            const userId = user?.uid || `guest_${Date.now()}`;
            const rawPhone = sessionStorage.getItem('verifiedPhone') || formData.mobile;
            const verifiedPhone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;
            if (itsImage) itsImageUrl = await compressImage(itsImage);
            if (libasImage) libasImageUrl = await compressImage(libasImage);

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
                welcomeEmailSent: !!(formData.email && !formData.email.endsWith('@dbohrarishta.local')),
            });

            // Automated Admin Welcome
            try {
                await addDoc(collection(db, 'admin_messages', userId, 'thread'), {
                    text: `Welcome to 53 DBohraRishta, ${formData.name}! 👋 Your biodata has been submitted and is now in the verification pipeline. Verification typically takes less than 24 hours. JazakAllah!`,
                    from: 'admin',
                    createdAt: serverTimestamp(),
                });
            } catch (adminErr) { console.warn('Admin message failed:', adminErr); }

            sessionStorage.removeItem('verifiedPhone');
            sessionStorage.removeItem('loginMethod');

            // Email/SMS Notifications Logic (Simplified for readability)
            if (formData.email && !formData.email.endsWith('@dbohrarishta.local')) {
                notifyWelcomeOnboarding({ candidateName: formData.name, candidateEmail: formData.email }).catch(() => {});
            }
            notifyAdminNewRegistration({ candidateName: formData.name, candidateEmail: formData.email, itsNumber: formData.itsNumber, gender: formData.gender, city: formData.location, onboardingStatus: 'submitted' }).catch(() => {});

            toast.success("Profile Setup Complete! Verification Pending.");
            router.push("/");
        } catch (error: any) {
            console.error("Setup Error", error);
            toast.error(`Error saving profile: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center p-6 text-[#881337] pt-12 pb-24" suppressHydrationWarning>
            <div className="max-w-2xl w-full">

                {/* Logout Button */}
                <div className="flex justify-end mb-6">
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
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-10 relative px-10">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-[#D4AF37] -z-10 -translate-y-1/2 rounded-full transition-all duration-300"
                        style={{ width: `${(step - 1) * 100}%` }}
                    ></div>
                    {[1, 2].map((num) => (
                        <div
                            key={num}
                            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center font-bold text-xs border-4 transition-all duration-500 relative ${step >= num ? 'bg-[#881337] text-white border-white shadow-[0_0_20px_rgba(136,19,55,0.2)]' : 'bg-white text-gray-400 border-gray-100'}`}
                        >
                            {num}
                            <span className={`absolute -bottom-8 text-[11px] font-black uppercase tracking-widest whitespace-nowrap ${step === num ? 'text-[#881337]' : 'text-gray-400'}`}>
                                {num === 1 ? 'Primary Info' : 'Details & Photos'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Main Form Holder */}
                <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-gray-100 p-8 md:p-12">
                    
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="bg-[#881337]/5 p-3 rounded-2xl">
                                    <User className="w-8 h-8 text-[#D4AF37]" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-black font-serif">Basic Profile</h2>
                                    <p className="text-sm text-gray-500 font-medium italic">Essential details to start your journey.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Full Name</label>
                                    <input name="name" onChange={handleChange} value={formData.name} className={`w-full bg-gray-50 border ${errors.name ? 'border-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-2xl px-5 py-4 focus:ring-2 outline-none transition-all shadow-sm font-semibold`} placeholder="e.g. Murtaza Ali Shopurwala" />
                                    {errors.name && <p className="text-red-500 text-xs font-bold mt-2 ml-1">{errors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Gender</label>
                                    <select name="gender" onChange={handleChange} value={formData.gender} className={`w-full bg-gray-50 border ${errors.gender ? 'border-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-2xl px-5 py-4 focus:ring-2 outline-none font-semibold shadow-sm`}>
                                        <option value="">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                    {errors.gender && <p className="text-red-500 text-xs font-bold mt-2 ml-1">{errors.gender}</p>}
                                </div>

                                <div className="space-y-1">
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Date of Birth</label>
                                    <input 
                                        type="date" 
                                        name="dob" 
                                        onChange={handleChange} 
                                        value={formData.dob} 
                                        max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                                        className={`w-full bg-gray-50 border ${errors.dob ? 'border-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-2xl px-5 py-4 focus:ring-2 outline-none font-semibold shadow-sm`} 
                                    />
                                    {errors.dob && <p className="text-red-500 text-xs font-bold mt-2 ml-1">{errors.dob}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Marital Status</label>
                                    <select name="maritalStatus" onChange={handleChange} value={formData.maritalStatus} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#881337] outline-none font-semibold shadow-sm">
                                        <option value="Single">Single</option>
                                        <option value="Divorced">Divorced</option>
                                        <option value="Widowed">Widowed</option>
                                        <option value="Awaiting Divorce">Awaiting Divorce</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 mb-1 uppercase">Height (Ft)</label>
                                        <select name="heightFeet" onChange={handleChange} value={formData.heightFeet} className={`w-full bg-gray-50 border ${errors.heightFeet ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-4 py-4 font-semibold shadow-sm`}>
                                            <option value="">Ft</option>
                                            {['4','5','6','7'].map(f => <option key={f} value={f}>{f} ft</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-gray-500 mb-1 uppercase">In</label>
                                        <select name="heightInch" onChange={handleChange} value={formData.heightInch} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 font-semibold shadow-sm">
                                            {Array.from({length: 12}, (_, i) => i).map(i => <option key={i} value={i.toString()}>{i} in</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Email</label>
                                        <input type="email" name="email" onChange={handleChange} value={formData.email} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-semibold shadow-sm opacity-80" readOnly={!!user?.email && !user.email.endsWith('@dbohrarishta.local')} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Mobile Number</label>
                                        <input 
                                            type="number" 
                                            name="mobile" 
                                            onChange={handleChange} 
                                            value={formData.mobile} 
                                            placeholder="918888888888"
                                            onInput={(e) => {
                                                const val = e.currentTarget.value;
                                                if (val.length > 14) e.currentTarget.value = val.slice(0, 14);
                                            }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4 font-semibold shadow-sm focus:ring-2 focus:ring-[#881337] outline-none" 
                                            readOnly={loginMethod === 'mobile'} 
                                        />
                                        <p className="text-[10px] text-gray-400 mt-2 font-bold px-1 italic">Include country code digits (e.g., 91, 971, 1)</p>
                                    </div>
                                </div>
                            </div>

                            <button onClick={handleNext} className="w-full bg-[#881337] text-white py-5 rounded-2xl font-black text-lg hover:bg-[#9F1239] transition-all shadow-xl hover:-translate-y-1 active:scale-95 mt-6 uppercase tracking-widest">
                                Next: Details & Photos
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500">
                            
                            {/* Verification Row */}
                            <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[2rem] flex gap-5 shadow-sm">
                                <Clock className="w-8 h-8 text-amber-600 shrink-0" />
                                <div>
                                    <p className="font-black text-amber-900 mb-2 text-lg">Mandatory Identity Check</p>
                                    <p className="text-sm text-amber-800 leading-relaxed font-bold">
                                        Upload your <span className="underline">original ITS card</span> and a <span className="underline">professional profile photo</span>. Official verification typically takes <span className="bg-amber-200 px-1 rounded">on or before 24 hours</span>. Profiles with missing, blurred, or fake documents are rejected immediately.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">ITS Number</label>
                                    <input 
                                        type="number" 
                                        name="itsNumber" 
                                        onChange={handleChange} 
                                        value={formData.itsNumber} 
                                        onInput={(e) => {
                                            const val = e.currentTarget.value;
                                            if (val.length > 8) e.currentTarget.value = val.slice(0, 8);
                                        }}
                                        className={`w-full bg-gray-50 border ${errors.itsNumber ? 'border-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-2xl px-5 py-4 focus:ring-2 outline-none font-semibold shadow-sm`} 
                                        placeholder="8-digit ITS" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Primary Jamaat</label>
                                    <input name="jamaat" onChange={handleChange} value={formData.jamaat} className={`w-full bg-gray-50 border ${errors.jamaat ? 'border-red-500' : 'border-gray-200 focus:ring-[#881337]'} rounded-2xl px-5 py-4 focus:ring-2 outline-none font-semibold shadow-sm`} placeholder="e.g. Husaini Jamaat" />
                                </div>
                            </div>

                            {/* Photo Inputs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className={`border-2 border-dashed ${errors.itsImage ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'} rounded-3xl p-6 flex flex-col items-center gap-3 transition-colors`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${errors.itsImage ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Candidate ITS Card Photo *</span>
                                    {imagePreview ? (
                                        <div className="relative group w-full aspect-video rounded-2xl overflow-hidden shadow-md">
                                            <img src={imagePreview} className="w-full h-full object-cover" />
                                            <button onClick={() => { setItsImage(null); setImagePreview(null); }} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-all">Retake</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
                                            <Camera className={`w-10 h-10 ${errors.itsImage ? 'text-red-300' : 'text-gray-300'}`} />
                                            <div className="flex gap-2 w-full">
                                                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50">Camera</button>
                                                <button onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=(e:any)=>handleImageCapture(e); i.click(); }} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50">Gallery</button>
                                            </div>
                                            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageCapture} />
                                        </div>
                                    )}
                                    {errors.itsImage && <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-tighter">{errors.itsImage}</p>}
                                </div>

                                <div className={`border-2 border-dashed ${errors.libasImage ? 'border-red-500 bg-red-50/30' : 'border-gray-200 bg-gray-50/50'} rounded-3xl p-6 flex flex-col items-center gap-3 transition-colors`}>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${errors.libasImage ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-400'}`}>Profile Photo (Preferably in Libas-al-Anwar) *</span>
                                    {libasImagePreview ? (
                                        <div className="relative group w-full aspect-[3/4] rounded-2xl overflow-hidden shadow-md">
                                            <img src={libasImagePreview} className="w-full h-full object-cover" />
                                            <button onClick={() => { setLibasImage(null); setLibasImagePreview(null); }} className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold transition-all">Retake</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-4 w-full h-full justify-center">
                                            <Camera className={`w-10 h-10 ${errors.libasImage ? 'text-red-300' : 'text-gray-300'}`} />
                                            <div className="flex gap-2 w-full">
                                                <button onClick={() => libasFileInputRef.current?.click()} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50">Camera</button>
                                                <button onClick={() => { const i = document.createElement('input'); i.type='file'; i.accept='image/*'; i.onchange=(e:any)=>handleLibasImageCapture(e); i.click(); }} className="flex-1 bg-white border border-gray-200 py-3 rounded-xl font-bold text-xs shadow-sm hover:bg-gray-50">Gallery</button>
                                            </div>
                                            <input type="file" accept="image/*" capture="environment" ref={libasFileInputRef} className="hidden" onChange={handleLibasImageCapture} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gray-50/80 p-5 rounded-2xl flex gap-3 border border-gray-100 mt-2">
                                <Info className="w-4 h-4 text-[#881337] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                                    <span className="text-[#881337] uppercase">Note:</span> You can add a <span className="text-blue-600">verified selfie</span> and additional profile photos from the <span className="underline">"My BioData"</span> section once your profile is officially verified by the admin.
                                </p>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Family & Roots */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-black font-serif">Family & Roots</h3>
                                    <div className="h-[2px] flex-1 bg-gray-100" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Father's Name</label>
                                        <input name="fatherName" onChange={handleChange} value={formData.fatherName} className={`w-full bg-gray-50 border ${errors.fatherName ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm`} placeholder="Full name of Father" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Mother's Name</label>
                                        <input name="motherName" onChange={handleChange} value={formData.motherName} className={`w-full bg-gray-50 border ${errors.motherName ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm`} placeholder="Full name of Mother" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Ancestral Watan</label>
                                        <input name="ancestralWatan" onChange={handleChange} value={formData.ancestralWatan} className={`w-full bg-gray-50 border ${errors.ancestralWatan ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm`} placeholder="e.g. Sidhpur, Dahod, Surat" />
                                    </div>
                                </div>
                            </div>

                            {/* Dunyawi Details */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-3">
                                    <h3 className="text-xl font-black font-serif">Dunyawi Details</h3>
                                    <div className="h-[2px] flex-1 bg-gray-100" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Highest Education</label>
                                        <input name="education" onChange={handleChange} value={formData.education} className={`w-full bg-gray-50 border ${errors.education ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm`} placeholder="e.g. B.Tech / MBA" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">Current Location</label>
                                        <input name="location" onChange={handleChange} value={formData.location} className={`w-full bg-gray-50 border ${errors.location ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm`} placeholder="City, Country" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-black text-gray-700 mb-2 uppercase tracking-tight">About Me / My Expectations</label>
                                        <textarea name="bio" onChange={handleChange} value={formData.bio} rows={4} className={`w-full bg-gray-50 border ${errors.bio ? 'border-red-500' : 'border-gray-200'} rounded-2xl px-5 py-4 font-semibold shadow-sm resize-none`} placeholder="Share your values and what you look for in a partner..." />
                                        {errors.bio && <p className="text-red-500 text-[10px] font-black uppercase tracking-tight mt-2 ml-1 animate-in fade-in">{errors.bio}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4 pt-6">
                                <button onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-gray-500 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all">Back</button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex-[2] bg-[#D4AF37] text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:-translate-y-1 active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-3"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Submit Biodata"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
