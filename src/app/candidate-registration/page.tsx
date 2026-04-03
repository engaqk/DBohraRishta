"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Sparkles, Loader2, BookOpen, Smartphone, ExternalLink, Copy, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";
import { notifyAdminNewRegistration } from "@/lib/emailService";

const ErrorMsg = ({ msg }: { msg?: string }) => msg ? <p className="text-red-500 text-xs mt-1 font-semibold animate-in fade-in">{msg}</p> : null;

export default function CandidateRegistrationPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [libasImageUrl, setLibasImageUrl] = useState<string | null>(null);
    const [itsImageUrl, setItsImageUrl] = useState<string | null>(null);
    const [extraImageUrl, setExtraImageUrl] = useState<string | null>(null);
    const [isItsVerified, setIsItsVerified] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [submitError, setSubmitError] = useState("");


    // Full ITNC Candidate Form Data State
    const [formData, setFormData] = useState({
        // Primary
        ejamaatId: "",
        email: "",
        title: "Mr",
        firstName: "",
        lastName: "",
        gender: "male",
        dob: "",

        // Family
        jamaat: "",
        siblings: "0",
        fatherName: "",
        motherName: "",
        maritalStatus: "single",
        noOfChildren: "0",
        heightFeet: "",
        heightInch: "",
        citizenOf: "",
        ancestralWatan: "",

        // Contact
        mobileCode: "+91",
        mobile: "",
        address: "",
        city: "",
        pincode: "",
        state: "",
        country: "India",

        // Education
        hifzStatus: "Not doing Hifz",
        jameaStatus: "",
        completedUpto: "Graduation",
        pursuing: "",
        educationDetails: "",

        // Occupation
        dawatKhidmat: "",
        professionType: "",
        serviceType: "",
        selfEmployedType: "",
        employmentDetails: "",
        honoraryKhidmat: "",

        // Personal
        bio: "",
        hobbies: "",
        partnerQualities: "",
        parentViews: "",
        informationProvidedBy: "Myself (Candidate)",
        status: "",
        adminMessage: "",
        isBlurSecurityEnabled: true,
    });

    useEffect(() => {
        const fetchUserData = async () => {
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();

                    let fName = data.firstName || "";
                    let lName = data.lastName || "";
                    if (!fName && !lName && data.name) {
                        const parts = data.name.split(" ");
                        fName = parts[0] || "";
                        lName = parts.slice(1).join(" ") || "";
                    }

                    setLibasImageUrl(data.libasImageUrl || null);
                    setItsImageUrl(data.itsImageUrl || null);
                    setExtraImageUrl(data.extraImageUrl || null);
                    setIsItsVerified(data.isItsVerified === true);

                    setFormData(prev => ({
                        ...prev,
                        ...data, // merge existing data if any
                        ejamaatId: data.ejamaatId || data.itsNumber || prev.ejamaatId,
                        email: data.email || user.email || prev.email,
                        firstName: fName,
                        lastName: lName,
                        gender: data.gender || prev.gender,
                        dob: data.dob || prev.dob,
                        jamaat: data.jamaat || prev.jamaat,
                        fatherName: data.fatherName || prev.fatherName,
                        motherName: data.motherName || prev.motherName,
                        maritalStatus: data.maritalStatus || prev.maritalStatus,
                        mobile: data.mobile || prev.mobile,
                        educationDetails: data.educationDetails || data.education || prev.educationDetails,
                        professionType: data.professionType || (typeof data.profession === 'string' ? data.profession : '') || prev.professionType,
                        bio: data.bio || prev.bio,
                        status: data.status || prev.status,
                        adminMessage: data.adminMessage || '',
                    }));
                }
            }
        };
        fetchUserData();
    }, [user]);

    // Auto Save Logic
    useEffect(() => {
        const timeout = setTimeout(async () => {
            if (user && Object.keys(formData).length > 0 && formData.firstName !== "") {
                try {
                    await updateDoc(doc(db, "users", user.uid), {
                        ...formData,
                        isBlurSecurityEnabled: formData.isBlurSecurityEnabled
                    });
                } catch (e) {
                    console.error("Auto save error", e);
                }
            }
        }, 3000);
        return () => clearTimeout(timeout);
    }, [formData, user]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        
        let newErrorMessage = "";
        if (name === 'bio' || name === 'partnerQualities') {
            const fieldLabel = name === 'bio' ? 'About Me (Bio)' : 'Partner Preferences';
            if (value.includes('@')) {
                newErrorMessage = `Email addresses are not allowed in ${fieldLabel} for security`;
            } else {
                const digits = value.replace(/\D/g, '');
                if (digits.length >= 8) {
                    newErrorMessage = `Phone numbers/Contact info not allowed in ${fieldLabel}`;
                } else {
                    const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
                    const socialPattern = /\b(insta|fb|facebook|instagram|snapchat|snap|telegram|linkedin|whatsapp|wa)\b/i;
                    if (linkPattern.test(value)) {
                        newErrorMessage = `Website links are not allowed in ${fieldLabel}`;
                    } else if (socialPattern.test(value)) {
                        newErrorMessage = `Social media handles/links are not allowed in ${fieldLabel}`;
                    }
                }
            }
        }

        setErrors(prev => ({ 
            ...prev, 
            [name]: newErrorMessage ? newErrorMessage : (prev[name] ? "" : prev[name])
        }));
    };

    const handleLibasImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }
        setLoading(true);
        try {
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
                    setLibasImageUrl(canvas.toDataURL('image/jpeg', 0.5));
                    setLoading(false);
                    toast.success("Main Biodata photo ready!");
                };
            };
        } catch (error) {
            setLoading(false);
            toast.error("Failed to process image");
        }
    };

    const handleExtraImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image must be less than 5MB");
            return;
        }
        setLoading(true);
        try {
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
                    setExtraImageUrl(canvas.toDataURL('image/jpeg', 0.5));
                    setLoading(false);
                    toast.success("Additional photo ready!");
                };
            };
        } catch (error) {
            setLoading(false);
            toast.error("Failed to process image");
        }
    };

    // ── OTP-Verified Mobile Update ────────────────────────────────────────────
    const [newMobileInput, setNewMobileInput] = useState('+91');
    const [newMobileOtpCode, setNewMobileOtpCode] = useState('');
    const [mobileOtpSent, setMobileOtpSent] = useState(false);
    const [mobileOtpLoading, setMobileOtpLoading] = useState(false);

    const handleSendMobileOtp = async () => {
        if (!user?.email) {
            toast.error("No registered email found for verification.");
            return;
        }
        if (!newMobileInput || !newMobileInput.startsWith('+') || newMobileInput.length < 10) {
            toast.error("Enter a valid mobile number starting with + and country code.");
            return;
        }
        setMobileOtpLoading(true);
        try {
            const res = await fetch('/api/otp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email }),
            });
            const data = await res.json();
            if (data.success) {
                setMobileOtpSent(true);
                toast.success("Verification code sent to " + user.email);
            } else {
                toast.error(data.error || "Failed to send code");
            }
        } catch {
            toast.error("Connection error. Try again.");
        } finally {
            setMobileOtpLoading(false);
        }
    };

    const handleVerifyMobileOtp = async () => {
        if (!newMobileOtpCode || newMobileOtpCode.length !== 6) {
            toast.error("Enter the 6-digit verification code.");
            return;
        }
        if (!user?.email) return;
        setMobileOtpLoading(true);
        try {
            const res = await fetch('/api/otp/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, code: newMobileOtpCode }),
            });
            const data = await res.json();
            if (!data.success) {
                toast.error(data.error || "Invalid verification code");
                return;
            }
            // OTP verified — save the new mobile to Firestore
            const { updateDoc, doc: firestoreDoc } = await import('firebase/firestore');
            await updateDoc(firestoreDoc(db, "users", user.uid), {
                mobile: newMobileInput,
                verifiedPhone: newMobileInput,
            });
            setFormData(prev => ({ ...prev, mobile: newMobileInput }));
            setMobileOtpSent(false);
            setNewMobileInput('+91');
            setNewMobileOtpCode('');
            toast.success("✅ Mobile number verified and updated!");
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setMobileOtpLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");

        let newErrors: { [key: string]: string } = {};

        // eJamaat / ITS validation (Strictly 8 digits)
        if (!formData.ejamaatId) {
            newErrors.ejamaatId = "eJamaat ID (ITS) is required";
        } else if (!/^\d{8}$/.test(formData.ejamaatId)) {
            newErrors.ejamaatId = "ITS Number must be exactly 8 numeric digits";
        }

        if (!formData.firstName) newErrors.firstName = "First Name is required";

        // Email optional, but validated if present
        if (formData.email && !/^\S+@\S+\.\S+$/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address";
        }

        // Mobile validation
        if (formData.mobile) {
            if (!/^\+?\d+$/.test(formData.mobile) || formData.mobile.length < 8 || formData.mobile.length > 15) {
                newErrors.mobile = "Please enter a valid mobile number (digits and optional + at start, length 8-15)";
            }
        } else {
            // Only require if it's completely missing
            newErrors.mobile = "Mobile number is required";
        }

        // Additional Required Form Validation Check
        if (!formData.jamaat) newErrors.jamaat = "Jamaat is required";
        if (!formData.dob) newErrors.dob = "Date of Birth is required";
        if (!formData.gender) newErrors.gender = "Gender is required";
        if (!formData.educationDetails && !formData.professionType) {
            newErrors.general = "Please provide education or profession details";
        }
        if (!libasImageUrl) {
            newErrors.photo = "Biodata Photo (Kaumi Libas) is required";
        }

        // --- 🛡️ Contact Leakage Prevention (Bio & Partner Qualities) ---
        const contactCheck = (text: string, fieldName: string) => {
            if (!text) return null;
            if (text.includes('@')) return `Email addresses are not allowed in ${fieldName} for security`;
            const digits = text.replace(/\D/g, '');
            if (digits.length >= 8) return `Phone numbers/Contact info not allowed in ${fieldName}`;
            const linkPattern = /(?:www\.|https?:\/\/|[a-z0-9]+\.[a-z]{2,})/i;
            if (linkPattern.test(text)) return `Website links are not allowed in ${fieldName}`;
            return null;
        };

        const bioError = contactCheck(formData.bio, 'About Me (Bio)');
        if (bioError) newErrors.bio = bioError;

        const pqError = contactCheck(formData.partnerQualities, 'Partner Preferences');
        if (pqError) newErrors.partnerQualities = pqError;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setSubmitError("Please fix the highlighted fields to continue.");
            
            // Scroll to the first error
            const firstErrorKey = Object.keys(newErrors)[0];
            const el = document.getElementsByName(firstErrorKey)[0] || document.getElementById(firstErrorKey);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            else window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        setLoading(true);
        try {
            // Check for Duplicate ITS Number logic (Requirement: Only one verified profile per ITS)
            if (formData.ejamaatId) {
                const usersRef = collection(db, "users");
                const itsQuery = query(usersRef, where("ejamaatId", "==", formData.ejamaatId));
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
                        setSubmitError(`ITS Number ${formData.ejamaatId} is already registered with another account. Multiple registrations with the same ITS are not permitted.`);
                        setLoading(false);
                        // Send automated notification to the user about the duplicate attempt
                        if (formData.email) {
                            const { notifyDuplicateRegistration } = await import("@/lib/emailService");
                            notifyDuplicateRegistration({
                                candidateName: `${formData.firstName} ${formData.lastName}`.trim(),
                                candidateEmail: formData.email,
                                itsNumber: formData.ejamaatId
                            }).catch(() => {});
                        }
                        return;
                    }
                }
            }

            // Check for Duplicate Profile logic based on First Name, Last Name, and DOB
            if (formData.firstName && formData.lastName && formData.dob) {
                const usersRef = collection(db, "users");
                // Capitalize query strings assuming DB stores exact or we standardise it (here exact match for simplicity)
                const duplicateQuery = query(usersRef,
                    where("firstName", "==", formData.firstName.trim()),
                    where("lastName", "==", formData.lastName.trim()),
                    where("dob", "==", formData.dob)
                );
                const duplicateSnapshot = await getDocs(duplicateQuery);

                if (!duplicateSnapshot.empty) {
                    // Make sure it's not the current user's own duplicate check triggering
                    let isOnlyMe = true;
                    duplicateSnapshot.forEach(d => {
                        if (user && d.id !== user.uid) isOnlyMe = false;
                        if (!user) isOnlyMe = false;
                    });

                    if (!isOnlyMe) {
                        setSubmitError("A profile with this First Name, Last Name, and Date of Birth already exists.");
                        setLoading(false);
                        return;
                    }
                }
            }

            if (user) {
                const fullName = `${formData.firstName} ${formData.lastName}`.trim();

                const updateObj: any = {
                    ...formData,
                    name: fullName,
                    itsNumber: formData.ejamaatId,
                    isCandidateFormComplete: true,
                    libasImageUrl: libasImageUrl || null,
                    extraImageUrl: extraImageUrl || null,
                    // Explicitly preserve mobile-auth fields so they are never overwritten by a form update
                    loginMethod: (formData as any).loginMethod || undefined,
                    verifiedPhone: (formData as any).verifiedPhone || undefined,
                    notificationEmail: (formData as any).notificationEmail || formData.email || undefined,
                    isEmailVerified: !!(formData.email && !formData.email.endsWith('@dbohrarishta.local')),
                };

                // If they were rejected, switch back to 'pending_verification' on resubmit
                if (formData.status === 'rejected') {
                    updateObj.status = 'pending_verification';
                }

                await updateDoc(doc(db, "users", user.uid), updateObj);

                // ✅ Email Admin via Gmail SMTP API
                notifyAdminNewRegistration({
                    candidateName: fullName,
                    candidateEmail: formData.email,
                    itsNumber: formData.ejamaatId,
                    gender: formData.gender,
                    city: formData.city,
                    isResubmission: formData.status === 'rejected',
                    onboardingStatus: 'submitted'
                }).catch(() => { });

                // ✅ Email Candidate via Gmail SMTP API
                const { notifyUserRegistrationReceived } = await import('@/lib/emailService');
                notifyUserRegistrationReceived({
                    candidateName: fullName,
                    candidateEmail: formData.email,
                    itsNumber: formData.ejamaatId
                }).catch(() => { });

                toast.success("Biodata Updated Successfully!");
                router.push("/");
            } else {
                await new Promise(r => setTimeout(r, 2000));
                toast.success("Candidate Registration Submitted Successfully!");
                router.push("/login");
            }

        } catch (error: any) {
            setSubmitError("Failed to submit: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

                    {/* Header */}
                    <div className="bg-[#881337] p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <BookOpen className="w-48 h-48 -mr-10 -mt-10" />
                        </div>
                        <div className="flex-1 text-center md:text-left relative z-10">
                            <h1 className="text-3xl font-bold font-serif mb-2">Candidate Registration Form</h1>
                            <p className="text-[#D4AF37] font-medium tracking-wide text-sm">International Taiseer un Nikah Committee (I.T.NC.) Format</p>
                        </div>
                        <div className="flex gap-4 relative z-10 hidden md:flex">
                            {itsImageUrl && isItsVerified && (
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-white/50 shadow-xl overflow-hidden bg-white/10 flex items-center justify-center">
                                        <img src={itsImageUrl} alt="ITS Photo" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center mt-2 text-xs font-bold tracking-widest uppercase">
                                        <span className="text-emerald-300">✓ ITS Verified</span>
                                    </div>
                                </div>
                            )}
                            {libasImageUrl && (
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-[#D4AF37] shadow-xl overflow-hidden bg-white/10 flex items-center justify-center">
                                        <img src={libasImageUrl} alt="Kaumi Libas" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center mt-2 text-xs text-white/80 font-bold tracking-widest uppercase">Biodata Photo</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-12">
                        {submitError && (
                            <div className="p-4 bg-red-50 text-red-600 font-bold rounded-xl border border-red-200 shadow-sm flex items-center gap-3">
                                <span>{submitError}</span>
                            </div>
                        )}

                        {/* Admin Notification Banner for Rejection */}
                        {formData.status === 'rejected' && (
                            <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-xl shadow-sm animate-pulse flex flex-col gap-2">
                                <h3 className="text-[#881337] font-black text-lg flex items-center gap-2">
                                    <span className="text-xl">⚠️</span> Action Required: Profile Need Updates
                                </h3>
                                <p className="text-gray-700 text-sm">
                                    An Admin has reviewed your profile and requested some adjustments. Please fix the issue mentioned below and click 'Submit Candidate Form' to request re-approval.
                                </p>
                                <div className="mt-2 bg-white p-4 rounded-lg border border-rose-100 italic text-rose-800 font-medium">
                                    " {formData.adminMessage || "Please review and update your information/photos properly."} "
                                </div>
                            </div>
                        )}

                        {/* 1. PRIMARY */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">PRIMARY</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">eJamaat Id (ITS) *</label>
                                    <input 
                                        disabled 
                                        name="ejamaatId" 
                                        onChange={handleChange} 
                                        value={formData.ejamaatId} 
                                        className="w-full bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200 rounded-xl px-4 py-3 outline-none" 
                                    />
                                    <ErrorMsg msg={errors.ejamaatId} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email address</label>
                                    <input 
                                        disabled={(formData as any).loginMethod === 'google' || (!!user?.email && !user.email.endsWith('@dbohrarishta.local'))} 
                                        type="email" 
                                        name="email" 
                                        onChange={handleChange} 
                                        value={formData.email} 
                                        className={`w-full ${(formData as any).loginMethod === 'google' || (!!user?.email && !user.email.endsWith('@dbohrarishta.local')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 focus:ring-[#881337]'} border ${errors.email ? 'border-red-400 focus:ring-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none focus:ring-2`} 
                                    />
                                    <ErrorMsg msg={errors.email} />
                                </div>
                                <div className="grid grid-cols-[1fr_2fr] gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                                        <select name="title" onChange={handleChange} value={formData.title} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                            <option>Mr</option><option>Ms</option><option>Mrs</option><option>Dr</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">First Name *</label>
                                        <input 
                                            disabled 
                                            name="firstName" 
                                            onChange={handleChange} 
                                            value={formData.firstName} 
                                            className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.firstName ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} 
                                        />
                                        <ErrorMsg msg={errors.firstName} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label>
                                    <input 
                                        disabled 
                                        name="lastName" 
                                        onChange={handleChange} 
                                        value={formData.lastName} 
                                        className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200 rounded-xl px-4 py-3 outline-none`} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                                    <input 
                                        disabled 
                                        value={formData.gender === 'male' ? 'Male' : 'Female'} 
                                        className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.gender ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} 
                                    />
                                    <ErrorMsg msg={errors.gender} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                    <input 
                                        disabled 
                                        type="date" 
                                        name="dob" 
                                        onChange={handleChange} 
                                        value={formData.dob} 
                                        className="w-full bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200 rounded-xl px-4 py-3 outline-none" 
                                    />
                                    <ErrorMsg msg={errors.dob} />
                                </div>
                            </div>

                            {/* PHOTO MANAGEMENT (Add/Change) */}
                            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div id="photo" className={`p-5 border-2 border-dashed ${errors.photo ? 'border-red-400 bg-red-50/10' : 'border-[#D4AF37]/30 bg-[#D4AF37]/5'} rounded-2xl`}>
                                    <label className="block text-sm font-bold text-[#881337] mb-3">Main Biodata Photo (Kaumi Libas) *</label>
                                    <div className="flex items-center gap-4">
                                        {libasImageUrl ? (
                                            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border-2 border-white ring-2 ring-[#881337]/10 shrink-0">
                                                <img src={libasImageUrl} alt="Main" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                                                <span className="text-xl">📸</span>
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <input type="file" accept="image/*" onChange={handleLibasImageUpload} className="text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#881337] file:text-white hover:file:bg-[#9F1239] cursor-pointer" />
                                            <p className="text-[10px] text-gray-400 mt-2">Required for verification. Upload your <strong>single, clear photo in full Kaumi Libas</strong> for better results and approval.</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 border-2 border-dashed border-rose-200 bg-rose-50/50 rounded-2xl">
                                    <label className="block text-sm font-bold text-[#881337] mb-3">Additional Portrait Photo (Option)</label>
                                    <div className="flex items-center gap-4">
                                        {extraImageUrl ? (
                                            <div className="w-16 h-16 rounded-xl overflow-hidden shadow-md border-2 border-white ring-2 ring-rose-900/10 shrink-0">
                                                <img src={extraImageUrl} alt="Extra" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                                                <span className="text-xl">📸</span>
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <input type="file" accept="image/*" onChange={handleExtraImageUpload} className="text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#881337] file:text-white hover:file:bg-[#9F1239] cursor-pointer" />
                                            <p className="text-[10px] text-gray-400 mt-2">Upload a <strong>single, clear portrait photo</strong> for your profile gallery. Clear photos get better visibility.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </section>

                        {/* 2. FAMILY */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-4">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">2</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">FAMILY</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Jamaat (Mauze)</label>
                                    <input name="jamaat" onChange={handleChange} value={formData.jamaat} className={`w-full bg-gray-50 border ${errors.jamaat ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:ring-2 outline-none`} />
                                    <ErrorMsg msg={errors.jamaat} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Number of Siblings</label>
                                    <input type="number" min="0" name="siblings" onChange={handleChange} value={formData.siblings} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Father's Name</label>
                                    <input name="fatherName" onChange={handleChange} value={formData.fatherName} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mother's Name</label>
                                    <input name="motherName" onChange={handleChange} value={formData.motherName} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Marital Status</label>
                                    <select name="maritalStatus" onChange={handleChange} value={formData.maritalStatus} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option value="single">Single</option>
                                        <option value="widowed">Widowed</option>
                                        <option value="divorcee">Divorcee</option>
                                        <option value="divorce_after_nikah">Divorce after Nikah</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">No. of Children</label>
                                    <input type="number" min="0" name="noOfChildren" onChange={handleChange} value={formData.noOfChildren} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Height</label>
                                    <div className="flex gap-2">
                                        <input placeholder="Feet" name="heightFeet" onChange={handleChange} value={formData.heightFeet} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                                        <input placeholder="Inches" name="heightInch" onChange={handleChange} value={formData.heightInch} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Citizen Of / Watan</label>
                                    <div className="flex gap-2">
                                        <input placeholder="Citizen Of" name="citizenOf" onChange={handleChange} value={formData.citizenOf} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                                        <input placeholder="Ancestral Watan" name="ancestralWatan" onChange={handleChange} value={formData.ancestralWatan} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* 🛡️ Photo Privacy Toggle */}
                            <div className="mt-8 p-6 bg-rose-50 border-2 border-rose-100 rounded-2xl">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <h3 className="text-[#881337] font-black text-sm uppercase tracking-wider mb-1">Photo Privacy Control</h3>
                                        <p className="text-gray-600 text-[11px] leading-relaxed">
                                            Enable <strong>Blur Mode</strong> to keep your photos private. They will only be visible to users whose Interest Request you accept.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-rose-100">
                                        <span className={`text-[10px] font-bold ${!formData.isBlurSecurityEnabled ? 'text-gray-400' : 'text-[#881337]'}`}>BLUR</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, isBlurSecurityEnabled: !prev.isBlurSecurityEnabled }))}
                                            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${formData.isBlurSecurityEnabled ? 'bg-[#881337]' : 'bg-gray-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${formData.isBlurSecurityEnabled ? 'right-1' : 'left-1'}`} />
                                        </button>
                                        <span className={`text-[10px] font-bold ${formData.isBlurSecurityEnabled ? 'text-gray-400' : 'text-emerald-600'}`}>SHOW</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. CONTACT */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-4">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">CONTACT</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mobile Number {(formData as any).loginMethod === 'mobile' ? "(Verified)" : "*"}</label>
                                    <div className="mb-3">
                                        <input 
                                            disabled={(formData as any).loginMethod === 'mobile'} 
                                            name="mobile" 
                                            onChange={handleChange} 
                                            value={formData.mobile} 
                                            className={`w-full ${(formData as any).loginMethod === 'mobile' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-gray-50 focus:ring-[#881337]'} border ${errors.mobile ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} 
                                            placeholder="e.g. +919876543210" 
                                        />
                                    </div>
                                    <ErrorMsg msg={errors.mobile} />

                                    {/* OTP-Verified Mobile Update Section */}
                                    {user && (
                                        <div className="bg-rose-50 rounded-xl p-4 border border-rose-100 shadow-inner mt-2">
                                            <h3 className="font-bold text-[#881337] text-xs mb-1 uppercase tracking-wide">Update Mobile (OTP Verified)</h3>
                                            <p className="text-[11px] text-rose-800 mb-3 leading-relaxed font-medium">
                                                Enter your new number and verify it with a one-time code before saving.
                                            </p>

                                            {/* Step 1: Enter number and send OTP */}
                                            {!mobileOtpSent ? (
                                                <div className="space-y-3">
                                                    <input
                                                        type="tel"
                                                        inputMode="tel"
                                                        placeholder="New mobile (e.g. +919876543210)"
                                                        value={newMobileInput}
                                                        onChange={e => setNewMobileInput(e.target.value.replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, ''))}
                                                        className="border border-rose-200 focus:outline-none focus:ring-1 focus:ring-[#881337] rounded-lg w-full p-2.5 text-sm bg-white"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSendMobileOtp}
                                                        disabled={mobileOtpLoading}
                                                        className="w-full bg-[#881337] text-white py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-rose-900 active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        {mobileOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                                                        Send Verification Code
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Step 2: Enter OTP and verify */
                                                <div className="space-y-3">
                                                    <div className="text-xs text-green-700 bg-green-50 rounded-lg p-2.5 border border-green-200">
                                                        Code sent to your email <strong>{user.email}</strong>. Check your inbox/spam.
                                                    </div>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        maxLength={6}
                                                        placeholder="Enter 6-digit OTP"
                                                        value={newMobileOtpCode}
                                                        onChange={e => setNewMobileOtpCode(e.target.value.replace(/\D/g, ''))}
                                                        className="border border-rose-200 focus:outline-none focus:ring-1 focus:ring-[#881337] rounded-lg w-full p-2.5 text-sm bg-white text-center tracking-widest font-mono"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleVerifyMobileOtp}
                                                        disabled={mobileOtpLoading}
                                                        className="w-full bg-[#881337] text-white py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-rose-900 active:scale-95 flex items-center justify-center gap-2"
                                                    >
                                                        {mobileOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        Verify & Save Mobile
                                                    </button>
                                                    <button type="button" onClick={() => { setMobileOtpSent(false); setNewMobileOtpCode(''); }} className="w-full text-xs text-gray-400 hover:text-gray-600">
                                                        ← Change number
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Residential Address</label>
                                    <textarea name="address" onChange={handleChange} value={formData.address} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-[#881337]" />
                                </div>
                            </div>
                        </section>

                        {/* 4. EDUCATION */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">4</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">EDUCATION</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Hifz ul Quran</label>
                                    <select name="hifzStatus" onChange={handleChange} value={formData.hifzStatus} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option>Not doing Hifz</option><option>Currently doing Hifz</option><option>Hafiz ul Quran</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Completed Upto</label>
                                    <select name="completedUpto" onChange={handleChange} value={formData.completedUpto} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option>Primary School</option><option>Secondary School</option><option>Under Graduation</option><option>Graduation</option>
                                        <option>Diploma</option><option>Degree Course</option><option>Post-Graduation</option><option>Doctorate</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Education Details</label>
                                    <textarea name="educationDetails" onChange={handleChange} value={formData.educationDetails} rows={2} className={`w-full bg-gray-50 border ${errors.general ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:ring-2 outline-none resize-none`} placeholder="Elaborate on your degrees..." />
                                    {errors.general && <div id="general" />}
                                    <ErrorMsg msg={errors.general} />
                                </div>
                            </div>
                        </section>

                        {/* 5. OCCUPATION */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">5</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">OCCUPATION</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Profession Type</label>
                                    <select name="professionType" onChange={handleChange} value={formData.professionType || ""} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option value="" disabled>Select Profession...</option>
                                        <option value="Accountant">Accountant</option>
                                        <option value="Doctor">Doctor</option>
                                        <option value="Engineer">Engineer</option>
                                        <option value="Designer">Designer</option>
                                        <option value="Teacher">Teacher</option>
                                        <option value="IT Professional">IT Professional</option>
                                        <option value="Technician/Mechanic">Technician/Mechanic</option>
                                        <option value="Business">Business</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Service / Job Role</label>
                                    <input name="serviceType" onChange={handleChange} value={formData.serviceType} placeholder="e.g. Executive, Manager..." className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Employment Details</label>
                                    <textarea name="employmentDetails" onChange={handleChange} value={formData.employmentDetails} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none resize-none" placeholder="Where do you work? Business details?" />
                                </div>
                            </div>
                        </section>

                        {/* 6. PERSONAL */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">6</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">PERSONAL DETAILS</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Tell us something about yourself</label>
                                    <textarea 
                                        name="bio" 
                                        onChange={handleChange} 
                                        value={formData.bio} 
                                        rows={3} 
                                        className={`w-full bg-gray-50 border ${errors.bio ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 outline-none resize-none focus:ring-2`} 
                                    />
                                    <ErrorMsg msg={errors.bio} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Your 3 Main Hobbies</label>
                                    <input name="hobbies" onChange={handleChange} value={formData.hobbies} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. Reading, Travel, Cooking" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Qualities you want in your life partner</label>
                                    <textarea 
                                        name="partnerQualities" 
                                        onChange={handleChange} 
                                        value={formData.partnerQualities} 
                                        rows={2} 
                                        className={`w-full bg-gray-50 border ${errors.partnerQualities ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 outline-none resize-none focus:ring-2`} 
                                    />
                                    <ErrorMsg msg={errors.partnerQualities} />
                                </div>
                                <div className="p-5 bg-rose-50/30 border border-rose-100 rounded-2xl">
                                    <label className="block text-sm font-bold text-[#881337] mb-2 leading-tight">Rishta Guardian Mode</label>
                                    <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">Is this profile managed by the candidate themselves or a Parent/Guardian?</p>
                                    <select
                                        name="informationProvidedBy"
                                        onChange={handleChange}
                                        value={formData.informationProvidedBy}
                                        className="w-full bg-white border border-rose-100 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#881337] outline-none"
                                    >
                                        <option value="Myself (Candidate)">Managed by Candidate (Self)</option>
                                        <option value="Parent/Guardian (Wali)">Managed by Parent/Guardian (Wali Mode)</option>
                                        <option value="Sibling">Managed by Sibling</option>
                                        <option value="Friend/Relative">Managed by Friend/Relative</option>
                                    </select>
                                </div>

                            </div>
                        </section>

                        <div className="pt-6 border-t border-gray-200">
                            {errors.photo && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-red-700 text-sm font-bold flex items-center gap-2">
                                        {errors.photo}
                                    </p>
                                    <p className="text-red-600/80 text-xs mt-1">Please make sure your Kaumi Libas biodata photo is uploaded properly.</p>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#881337] text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-rose-900/20 hover:bg-[#9F1239] transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                            >
                                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                                Submit Candidate Form
                            </button>
                            <p className="text-center text-xs text-gray-400 mt-4">* By submitting, you consent to the ITNC guidelines.</p>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
