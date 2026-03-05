import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalNav from "@/components/GlobalNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DBohraRishta | Intelligent Matchmaking for the Dawoodi Bohra Community",
  description: "A trusted, community-centric matchmaking platform for the Dawoodi Bohra community. ITS-verified profiles, dynamic photo privacy, and intelligent Rishta connections.",
  keywords: "Bohra, Dawoodi Bohra, Rishta, matchmaking, matrimony, ITS verified, Muslim matrimony",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DBohraRishta",
  },
  openGraph: {
    title: "DBohraRishta — Intelligent Bohra Matchmaking",
    description: "ITS-verified profiles. Privacy-first. Bohra community matchmaking platform.",
    url: "https://dbohranisbat.web.app",
    siteName: "DBohraRishta",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DBohraRishta",
    description: "Intelligent matchmaking for the Dawoodi Bohra community.",
  },
  other: {
    "theme-color": "#881337",
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
        {/* Anti-screenshot / print styling hidden in normal display but covers screen on print */}
        <div className="fixed inset-0 z-[9999] bg-black text-white flex justify-center items-center text-3xl font-bold opacity-0 pointer-events-none" id="screenshot-blocker">
          Screenshots Disabled for Security
        </div>
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
                html, body { display: none !important; }
            }
            body { -webkit-touch-callout: none; }
        `}} />
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('contextmenu', event => event.preventDefault());
            document.addEventListener('keydown', function (e) {
              if (e.key === "PrintScreen") {
                  navigator.clipboard.writeText('');
                  alert("Screenshots are disabled for privacy.");
              }
              if (e.ctrlKey && e.key === 'p') {
                  e.cancelBubble = true;
                  e.preventDefault();
                  e.stopImmediatePropagation();
              }
          });
          `
        }} />
        <Providers>
          <ImpersonationBanner />
          <GlobalNav />
          <div className="pt-16">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
