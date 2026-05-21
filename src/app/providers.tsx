"use client";

import React from "react";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { LanguageProvider } from "@/lib/contexts/LanguageContext";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <LanguageProvider>
            <AuthProvider>
                <Toaster position="top-center" />
                {children}
            </AuthProvider>
        </LanguageProvider>
    );
}
