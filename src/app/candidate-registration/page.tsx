"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Heart, Loader2, BookOpen } from "lucide-react";
import toast from "react-hot-toast";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function CandidateRegistrationPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (errors[e.target.name]) {
            setErrors({ ...errors, [e.target.name]: "" });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            toast.error("Please fill in the required fields correctly.");
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
                    toast.error("A profile with this First Name, Last Name, and Date of Birth already exists.");
                    setLoading(false);
                    return;
                }
            }

            // Because this is a mock save for the separate registration page, 
            // we will simulate an API delay then redirect them to login/onboarding.
            await new Promise(r => setTimeout(r, 2000));
            toast.success("Candidate Registration Submitted Successfully!");
            router.push("/login");
        } catch (error: any) {
            toast.error("Failed to submit: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">

                    {/* Header */}
                    <div className="bg-[#881337] p-8 text-white text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                            <BookOpen className="w-48 h-48 -mr-10 -mt-10" />
                        </div>
                        <h1 className="text-3xl font-bold font-serif relative z-10">Candidate Registration Form</h1>
                        <p className="text-[#D4AF37] font-medium tracking-wide text-sm mt-2 relative z-10">International Taiseer un Nikah Committee (I.T.NC.) Format</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-12">

                        {/* 1. PRIMARY */}
                        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                            <div className="flex items-center gap-3 border-b-2 border-gray-100 pb-3 mb-6">
                                <span className="bg-[#D4AF37] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
                                <h2 className="text-xl font-bold font-serif text-[#881337]">PRIMARY</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">eJamaat Id (ITS) *</label>
                                    <input name="ejamaatId" onChange={handleChange} value={formData.ejamaatId} className={`w-full bg-gray-50 border ${errors.ejamaatId ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none`} />
                                    {errors.ejamaatId && <p className="text-red-500 text-xs mt-1">{errors.ejamaatId}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email address</label>
                                    <input type="email" name="email" onChange={handleChange} value={formData.email} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
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
                                        <input name="firstName" onChange={handleChange} value={formData.firstName} className={`w-full bg-gray-50 border ${errors.firstName ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none`} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label>
                                    <input name="lastName" onChange={handleChange} value={formData.lastName} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Gender</label>
                                    <select name="gender" onChange={handleChange} value={formData.gender} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                                    <input type="date" name="dob" onChange={handleChange} value={formData.dob} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
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
                                    <input name="jamaat" onChange={handleChange} value={formData.jamaat} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none" />
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
                                        <input name="mobileCode" onChange={handleChange} value={formData.mobileCode} className="w-1/4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none" placeholder="+91" />
                                        <input name="mobile" onChange={handleChange} value={formData.mobile} className={`w-3/4 bg-gray-50 border ${errors.mobile ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#881337]`} placeholder="e.g. 9876543210" />
                                    </div>
                                    {errors.mobile && <p className="text-red-500 text-xs mt-1">{errors.mobile}</p>}
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
                                    <textarea name="educationDetails" onChange={handleChange} value={formData.educationDetails} rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#881337] outline-none resize-none" placeholder="Elaborate on your degrees..." />
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
