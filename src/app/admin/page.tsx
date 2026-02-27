"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.push("/admin/approvals");
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[#881337]">
            <p className="animate-pulse font-bold">Redirecting to Approvals...</p>
        </div>
    );
}
