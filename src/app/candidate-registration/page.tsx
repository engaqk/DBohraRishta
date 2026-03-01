"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Heart, Loader2, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/contexts/AuthContext";

const ErrorMsg = ({ msg }: { msg?: string }) => msg ? <p className="text-red-500 text-xs mt-1 font-semibold animate-in fade-in">{msg}</p> : null;

export default function CandidateRegistrationPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [libasImageUrl, setLibasImageUrl] = useState<string | null>(null);
    const [itsImageUrl, setItsImageUrl] = useState<string | null>(null);
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
        landlineCode: "",
        landline: "",
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
        professionType: "IT Professional",
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
                        educationDetails: data.education || prev.educationDetails,
                        professionType: data.profession || prev.professionType,
                        bio: data.bio || prev.bio,
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
                        ...formData
                    });
                } catch (e) {
                    console.error("Auto save error", e);
                }
            }
        }, 3000);
        return () => clearTimeout(timeout);
    }, [formData, user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
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
        if (!formData.mobile) {
            newErrors.mobile = "Mobile number is required";
        } else if (!/^\d+$/.test(formData.mobile) || formData.mobile.length < 8 || formData.mobile.length > 15) {
            newErrors.mobile = "Please enter a valid mobile number (digits only, length 8-15)";
        }

        // Additional Required Form Validation Check
        if (!formData.jamaat) newErrors.jamaat = "Jamaat is required";
        if (!formData.dob) newErrors.dob = "Date of Birth is required";
        if (!formData.gender) newErrors.gender = "Gender is required";
        if (!formData.educationDetails && !formData.professionType) {
            newErrors.general = "Please provide education or profession details";
        }
        if (!libasImageUrl) {
            newErrors.photo = "Profile Photo (Kaumi Libas) is required";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            setSubmitError("Please fix the highlighted fields to continue.");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }

        setLoading(true);
        try {
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
                // Determine full name
                const fullName = `${formData.firstName} ${formData.lastName}`.trim();

                await updateDoc(doc(db, "users", user.uid), {
                    ...formData,
                    name: fullName,
                    itsNumber: formData.ejamaatId,
                    isCandidateFormComplete: true
                });
                // Email Notification Call (Mock fetch placeholder for serverless function/email trigger)
                // In production, an API route or Firebase Extension would handle actually dispatching this email.
                try {
                    console.log("Sending email notification to abdulqadirkhanji52@gmail.com for exact new verification request from", fullName);
                    // fetch("/api/notify-admin", { method: "POST", body: JSON.stringify({ email: "abdulqadirkhanji52@gmail.com", user: fullName }) })
                } catch (e) { }

                toast.success("Profile Details Updated Successfully!");
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
                            {itsImageUrl && (
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-white/50 shadow-xl overflow-hidden bg-white/10 flex items-center justify-center">
                                        <img src={itsImageUrl} alt="ITS Photo" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center mt-2 text-xs text-white/80 font-bold tracking-widest uppercase">Verified ITS</div>
                                </div>
                            )}
                            {libasImageUrl && (
                                <div className="flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-full border-4 border-[#D4AF37] shadow-xl overflow-hidden bg-white/10 flex items-center justify-center">
                                        <img src={libasImageUrl} alt="Kaumi Libas" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="text-center mt-2 text-xs text-white/80 font-bold tracking-widest uppercase">Profile Photo</div>
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

                        {/* 1. PRIMARY */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">PRIMARY</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">eJamaat Id (ITS) *</label>
                                    <input disabled title="Verified ITS Number cannot be changed" name="ejamaatId" onChange={handleChange} value={formData.ejamaatId} className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.ejamaatId ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} />
                                    <ErrorMsg msg={errors.ejamaatId} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email address</label>
                                    <input disabled type="email" name="email" onChange={handleChange} value={formData.email} className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.email ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} />
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
                                        <input disabled name="firstName" onChange={handleChange} value={formData.firstName} className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.firstName ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} />
                                        <ErrorMsg msg={errors.firstName} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label>
                                    <input disabled name="lastName" onChange={handleChange} value={formData.lastName} className="w-full bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200 rounded-xl px-4 py-3 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                                    <input disabled value={formData.gender === 'male' ? 'Male' : 'Female'} className={`w-full bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.gender ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} />
                                    <ErrorMsg msg={errors.gender} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                    <input type="date" name="dob" onChange={handleChange} value={formData.dob} className={`w-full bg-gray-50 border ${errors.dob ? 'border-red-400 focus:ring-red-400' : 'border-gray-200 focus:ring-[#881337]'} rounded-xl px-4 py-3 focus:ring-2 outline-none`} />
                                    <ErrorMsg msg={errors.dob} />
                                </div>
                            </div>
                        </section>

                        {/* 2. FAMILY */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
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
                        </section>

                        {/* 3. CONTACT */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">CONTACT</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Mobile Number *</label>
                                    <div className="flex gap-2">
                                        <input disabled name="mobileCode" onChange={handleChange} value={formData.mobileCode} className="w-1/4 bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="+91" />
                                        <input disabled name="mobile" onChange={handleChange} value={formData.mobile} className={`w-3/4 bg-gray-100 text-gray-500 cursor-not-allowed border ${errors.mobile ? 'border-red-400' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} placeholder="e.g. 9876543210" />
                                    </div>
                                    <ErrorMsg msg={errors.mobile} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Landline (Optional)</label>
                                    <div className="flex gap-2">
                                        <input name="landlineCode" onChange={handleChange} value={formData.landlineCode} className="w-1/4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="022" />
                                        <input name="landline" onChange={handleChange} value={formData.landline} className="w-3/4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. 2345678" />
                                    </div>
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
                                    <select name="professionType" onChange={handleChange} value={formData.professionType} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option>Accountant</option><option>Doctor</option><option>Engineer</option><option>Designer</option><option>Teacher</option>
                                        <option>IT Professional</option><option>Technician/Mechanic</option><option>Business</option><option>Other</option>
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
                                    <textarea name="bio" onChange={handleChange} value={formData.bio} rows={3} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-[#881337]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Your 3 Main Hobbies</label>
                                    <input name="hobbies" onChange={handleChange} value={formData.hobbies} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]" placeholder="e.g. Reading, Travel, Cooking" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Qualities you want in your life partner</label>
                                    <textarea name="partnerQualities" onChange={handleChange} value={formData.partnerQualities} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none resize-none focus:ring-2 focus:ring-[#881337]" />
                                </div>
                            </div>
                        </section>

                        <div className="pt-6 border-t border-gray-200">
                            {errors.photo && (
                                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                                    <p className="text-red-700 text-sm font-bold flex items-center gap-2">
                                        {errors.photo}
                                    </p>
                                    <p className="text-red-600/80 text-xs mt-1">Please make sure your Kaumi Libas profile photo is uploaded properly.</p>
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
