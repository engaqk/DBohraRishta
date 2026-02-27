"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, Camera, UploadCloud, CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/contexts/AuthContext";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/config";
import toast from "react-hot-toast";

export default function OnboardingPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data State
    const [formData, setFormData] = useState({
        name: "",
        gender: "",
        dob: "",
        itsNumber: "",
        jamaat: "",
        education: "",
        hizratLocation: "",
        bio: "",
    });

    // Image State
    const [itsImage, setItsImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    // File Input Ref for Mobile Camera explicitly
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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

    const handleNext = () => {
        if (step === 1 && (!formData.name || !formData.dob || !formData.gender)) {
            toast.error("Please fill in all basic profile fields.");
            return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setStep(step + 1);
    };

    const handleSubmit = async () => {
        if (!formData.education || !formData.hizratLocation || !formData.bio) {
            toast.error("Please complete your Dunyawi details.");
            return;
        }

        setLoading(true);
        let itsImageUrl = null;

        // Fallback ID for testing UI without strict login required
        const userId = user?.uid || `guest_${Date.now()}`;

        try {
            // 1. Upload the ITS image if provided
            if (itsImage) {
                const imageRef = ref(storage, `profiles/${userId}/its_card_${Date.now()}`);
                const uploadTask = await uploadBytesResumable(imageRef, itsImage);
                itsImageUrl = await getDownloadURL(uploadTask.ref);
            }

            // 2. Save complete profile to Firestore
            await setDoc(doc(db, "users", userId), {
                ...formData,
                userId: userId,
                itsImageUrl: itsImageUrl || null,
                isItsVerified: false, // Default to false, explicitly requires an Admin to flip this!
                status: "pending_verification",
                createdAt: new Date().toISOString()
            });

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
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center p-6 text-[#064E3B] pt-12 pb-24">
            <div className="max-w-xl w-full">
                {/* Progress Bar */}
                <div className="flex justify-between items-center mb-8 relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 -translate-y-1/2 rounded-full"></div>
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-[#D4AF37] -z-10 -translate-y-1/2 rounded-full transition-all duration-300"
                        style={{ width: `${((step - 1) / 2) * 100}%` }}
                    ></div>
                    {[1, 2, 3].map((num) => (
                        <div
                            key={num}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4 transition-colors ${step >= num ? 'bg-[#064E3B] text-white border-white shadow-md' : 'bg-white text-gray-400 border-gray-100'}`}
                        >
                            {num}
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
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                                <input name="name" onChange={handleChange} value={formData.name} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" placeholder="e.g. Murtaza Ali" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                                    <select name="gender" onChange={handleChange} value={formData.gender} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]">
                                        <option value="">Select Gender</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                    <input type="date" name="dob" max="2005-01-01" onChange={handleChange} value={formData.dob} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={handleNext} className="bg-[#064E3B] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#0a6b52] transition-colors shadow-md">Next</button>
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

                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex gap-3 text-sm text-yellow-800 mb-2">
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <p>Verify your ITS Card to secure 'Verified' badges and unlock access to private unblurred photos.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">ITS Number</label>
                                <input name="itsNumber" onChange={handleChange} value={formData.itsNumber} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" placeholder="e.g. 2045612" />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Primary Jamaat</label>
                                <input name="jamaat" onChange={handleChange} value={formData.jamaat} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" placeholder="e.g. Husaini Jamaat, London" />
                            </div>

                            {/* Mobile Real-time Camera Capture for ITS */}
                            <div className="mt-6 border border-gray-200 rounded-xl p-5 bg-white shadow-sm flex flex-col items-center">
                                <label className="text-center w-full block mb-2 font-bold text-sm text-[#064E3B]">Capture ITS Card Verification</label>
                                <p className="text-xs text-gray-500 text-center mb-4 leading-relaxed">
                                    We need to see your physical ITS card. This picture will only be viewed by an admin and will never be shown to other users.
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
                                            className="flex-1 border-2 border-dashed border-[#064E3B] bg-emerald-50 text-[#064E3B] hover:bg-emerald-100 transition-colors py-4 rounded-xl flex flex-col items-center justify-center gap-2"
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
                            </div>

                            <div className="flex justify-between pt-6">
                                <button onClick={() => setStep(1)} className="text-gray-500 px-6 py-3 font-bold hover:text-gray-700">Back</button>
                                <button onClick={handleNext} className="bg-[#064E3B] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#0a6b52] transition-colors shadow-md flex items-center gap-2">
                                    Next State
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Dunyawi Profile Details */}
                    {step === 3 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-start flex-col mb-6">
                                <h2 className="text-2xl font-bold font-serif mb-2">Dunyawi Details</h2>
                                <p className="text-sm text-gray-500">Education and current Hizrat (Location) preferences.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Highest Education</label>
                                <input name="education" onChange={handleChange} value={formData.education} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" placeholder="e.g. MBA in Finance" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Current Location</label>
                                <input name="hizratLocation" onChange={handleChange} value={formData.hizratLocation} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B]" placeholder="e.g. Dubai, UAE" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Bio (Be Intentional)</label>
                                <textarea name="bio" onChange={handleChange} value={formData.bio} rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#064E3B] resize-none" placeholder="Share your expectations for an alliance..." />
                            </div>
                            <div className="flex justify-between pt-4">
                                <button onClick={() => setStep(2)} className="text-gray-500 px-6 py-3 font-bold hover:text-gray-700" disabled={loading}>Back</button>
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
