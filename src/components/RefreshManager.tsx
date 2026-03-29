"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import toast from "react-hot-toast";

export default function RefreshManager() {
    const currentVersionRef = useRef<string | null>(null);
    const pathname = usePathname();

    useEffect(() => {
        const checkVersion = async () => {
            try {
                const res = await fetch('/api/version', { cache: 'no-store' });
                const data = await res.json();
                const currentServerVersion = data.version;

                if (currentVersionRef.current === null) {
                    currentVersionRef.current = currentServerVersion;
                } else if (currentVersionRef.current !== currentServerVersion && currentServerVersion !== 'development') {
                    console.log("New version detected. Marking for background update on next navigation...");
                    sessionStorage.setItem('pendingUpdate', 'true');
                }
            } catch (e) {}
        };

        // 1. Check once on mount (with short delay)
        const initialTimer = setTimeout(checkVersion, 3000);

        // 2. Check periodically in the background (silent & non-disruptive)
        const intervalTimer = setInterval(checkVersion, 10 * 60 * 1000); // Every 10 mins

        // 3. Check when user returns to the tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') checkVersion();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalTimer);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // 4. NAVIGATION INTERCEPTOR:
    // When the user navigates to a new page, if there's a pending update,
    // we force a full page reload to swap in the new version.
    useEffect(() => {
        if (sessionStorage.getItem('pendingUpdate') === 'true') {
            console.log("Swapping to new version on navigation...");
            sessionStorage.removeItem('pendingUpdate');
            sessionStorage.setItem('app_just_updated', 'true');
            
            // Forces the next page to be a full, fresh server load
            window.location.reload();
        }
    }, [pathname]);

    useEffect(() => {
        if (sessionStorage.getItem('app_just_updated') === 'true') {
            setTimeout(() => {
                toast.success("53DBohraRishta updated to latest version!", { icon: "✨", duration: 4000 });
                sessionStorage.removeItem('app_just_updated');
            }, 1000);
        }
    }, []);

    return null;
}
