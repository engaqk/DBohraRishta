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
                    console.log("New version detected. Silently marking for update on next navigation.");
                    sessionStorage.setItem('pendingUpdate', 'true');
                }
            } catch (e) {}
        };

        // Check initially and periodically (silently)
        const initialTimer = setTimeout(checkVersion, 3000);
        const intervalTimer = setInterval(checkVersion, 5 * 60 * 1000); // Check every 5 mins

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

    // SILENT NAVIGATION REFRESH:
    // When the user moves between pages/tabs, we refresh if an update was found.
    useEffect(() => {
        if (sessionStorage.getItem('pendingUpdate') === 'true') {
            console.log("Applying pending update silently on navigation...");
            sessionStorage.removeItem('pendingUpdate');
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
