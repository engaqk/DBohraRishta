"use client";

import React, { useEffect } from "react";
import { RefreshCw, Home, Sparkles } from "lucide-react";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const errorMsg = error?.message || String(error || "");
    const errorName = error?.name || "";
    const isChunk =
      errorName === "ChunkLoadError" ||
      errorMsg.includes("ChunkLoadError") ||
      errorMsg.includes("Failed to load chunk") ||
      errorMsg.includes("Loading chunk") ||
      errorMsg.includes("missing chunk");

    if (isChunk) {
      const now = Date.now();
      const lastReload = parseInt(
        sessionStorage.getItem("last_global_chunk_reload") || "0",
        10
      );
      if (now - lastReload > 10000) {
        sessionStorage.setItem("last_global_chunk_reload", String(now));
        try {
          if ("caches" in window) {
            caches
              .keys()
              .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
              .finally(() => {
                (window as any).location.reload();
              });
          } else {
            (window as any).location.reload();
          }
        } catch (_) {
          (window as any).location.reload();
        }
      }
    }
  }, [error]);

  const handleHardRefresh = () => {
    try {
      if ("caches" in window) {
        caches
          .keys()
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .finally(() => {
            (window as any).location.reload();
          });
      } else {
        (window as any).location.reload();
      }
    } catch (_) {
      (window as any).location.reload();
    }
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-rose-100 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-[#881337] flex items-center justify-center text-white mb-5 shadow-md">
            <Sparkles className="w-8 h-8 text-amber-200 animate-spin" />
          </div>

          <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-black mb-1">
            53DBohraRishta
          </p>

          <h2 className="text-2xl font-bold text-[#881337] mb-2">
            New Platform Update Ready ✨
          </h2>

          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            A new version of 53DBohraRishta has been deployed. Please tap below
            to refresh and continue seamlessly.
          </p>

          <button
            onClick={handleHardRefresh}
            className="w-full bg-[#881337] hover:bg-[#9F1239] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh Now</span>
          </button>
        </div>
      </body>
    </html>
  );
}
