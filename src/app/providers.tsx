"use client";

import React from "react";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <Toaster position="top-center" />
            {children}
        </AuthProvider>
    );
}
