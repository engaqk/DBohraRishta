"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

export default function RefreshManager() {
    const currentVersionRef = useRef<string | null>(null);

    useEffect(() => {
        const checkVersion = async () => {
            try {
                // Fetch the current deployment version on the server
                const res = await fetch('/api/version', { cache: 'no-store' });
                const data = await res.json();
                const currentServerVersion = data.version;
                
                if (currentVersionRef.current === null) {
                    // First load, save the current baseline version
                    currentVersionRef.current = currentServerVersion;
                } else if (currentVersionRef.current !== currentServerVersion && currentServerVersion !== 'development') {
                    // Version changed! A new deployment occurred while the user had the app open
                    console.log("New deployment detected. Reloading to get latest code...");
                    
                    // Mark cache to show toast on next load
                    sessionStorage.setItem('app_just_updated', 'true');
                    
                    // A true parameter would force cache clear on older browsers, but location.reload() does the trick
                    window.location.reload();
                }
            } catch (e) {
                // Silently handle errors (e.g. offline) so we don't spam the UI
            }
        };

        // Delay the first check slightly so it doesn't block critical rendering path
        const initialTimer = setTimeout(checkVersion, 3000);

        // Check if an update occurred every 5 minutes while the app stays open
        const intervalId = setInterval(checkVersion, 5 * 60 * 1000);

        // Also check whenever the user returns to the tab after it was hidden/in background
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Show a nice toast if we just refreshed due to an update
        if (sessionStorage.getItem('app_just_updated') === 'true') {
            setTimeout(() => {
                toast.success("App refreshed with the latest features!", { icon: "✨", duration: 4000 });
                sessionStorage.removeItem('app_just_updated');
            }, 1000);
        }

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return null; // This is a utility component, no UI needed
}
