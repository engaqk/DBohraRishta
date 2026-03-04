"use client";

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function NotFound() {
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // Handle legacy profile URLs (e.g. /profile/guest_123)
        // Redirect them to the static-export compatible URL (/profile?id=guest_123)
        if (pathname && pathname.startsWith('/profile/') && pathname.length > 9) {
            const potentialId = pathname.replace('/profile/', '');
            router.replace(`/profile?id=${potentialId}`);
        } else {
            // Otherwise, gently redirect to home or show error
            setTimeout(() => {
                router.replace('/');
            }, 3000);
        }
    }, [pathname, router]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-12 h-12 text-[#D4AF37] animate-spin mb-4" />
            <h2 className="text-2xl font-bold font-serif text-[#881337] mb-2">Finding Your Page...</h2>
            <p className="text-gray-500">If you are trying to view a profile, we are automatically redirecting you...</p>
        </div>
    );
}
