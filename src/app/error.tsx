"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Home, ShieldAlert, Sparkles } from "lucide-react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isChunkError, setIsChunkError] = useState(false);

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
      setIsChunkError(true);
      const now = Date.now();
      const lastReload = parseInt(
        sessionStorage.getItem("last_chunk_error_reload") || "0",
        10
      );
      // Auto-reload if not reloaded in the last 10 seconds
      if (now - lastReload > 10000) {
        sessionStorage.setItem("last_chunk_error_reload", String(now));
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
    <div className="min-h-screen bg-[#FFFDF9] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-rose-100 flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-[#881337] flex items-center justify-center text-white mb-5 shadow-md">
          {isChunkError ? (
            <Sparkles className="w-8 h-8 text-amber-200 animate-spin" />
          ) : (
            <ShieldAlert className="w-8 h-8 text-white" />
          )}
        </div>

        <p className="text-xs uppercase tracking-widest text-[#D4AF37] font-black mb-1">
          53DBohraRishta
        </p>

        <h2 className="text-2xl font-bold font-serif text-[#881337] mb-2">
          {isChunkError
            ? "New Version Available ✨"
            : "Platform Refresh Required"}
        </h2>

        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          {isChunkError
            ? "A fresh update was just deployed to 53DBohraRishta. Please refresh to load the latest features and candidate alignments."
            : "A momentary connection or display issue occurred. Refreshing the page will restore your session smoothly."}
        </p>

        <div className="w-full space-y-3">
          <button
            onClick={handleHardRefresh}
            className="w-full bg-[#881337] hover:bg-[#9F1239] text-white py-3.5 px-6 rounded-2xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh to Latest Version</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 px-6 rounded-2xl font-semibold text-xs border border-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return to Home</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-400 mt-6">
          Bi idnillah, all candidate profiles and data are safe and secure.
        </p>
      </div>
    </div>
  );
}
