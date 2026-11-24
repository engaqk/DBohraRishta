import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import GlobalNav from "@/components/GlobalNav";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import PushNotificationHandler from "@/components/PushNotificationHandler";
import RefreshManager from "@/components/RefreshManager";
import PageWrapper from "@/components/PageWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "53DBohraRishta | Intelligent Rishta Platform for the Dawoodi Bohra Community",
  description: "A trusted, community-centric Rishta platform for the Dawoodi Bohra community. ITS-verified profiles, dynamic photo privacy, and intelligent Rishta connections.",
  keywords: "Bohra, Dawoodi Bohra, Rishta, matrimony, ITS verified, Muslim matrimony",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "53DBohraRishta",
  },
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
  openGraph: {
    title: "53DBohraRishta — Intelligent Bohra Rishta Platform",
    description: "ITS-verified profiles. Privacy-first. Bohra community Rishta platform.",
    url: "https://www.53dbohrarishta.in",
    siteName: "53DBohraRishta",
    locale: "en_US",
    type: "website",
    images: ["/icon-512.png"],
  },
  twitter: {
    card: "summary",
    title: "53DBohraRishta",
    description: "Intelligent Rishta platform for the Dawoodi Bohra community.",
    images: ["/icon-512.png"],
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
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
        {/* ChunkLoadError & Stale Build Auto-Healing Script */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              function isChunkError(err) {
                try {
                  var msg = (err && (err.message || (err.error && err.error.message) || String(err))) || '';
                  var name = (err && (err.name || (err.error && err.error.name))) || '';
                  return (
                    name === 'ChunkLoadError' ||
                    msg.indexOf('ChunkLoadError') !== -1 ||
                    msg.indexOf('Failed to load chunk') !== -1 ||
                    msg.indexOf('Loading chunk') !== -1 ||
                    msg.indexOf('missing chunk') !== -1
                  );
                } catch(e) { return false; }
              }

              function handleChunkFailure() {
                try {
                  var now = Date.now();
                  var key = 'next_chunk_reload_ts';
                  var last = parseInt(sessionStorage.getItem(key) || '0', 10);
                  if (now - last > 8000) {
                    sessionStorage.setItem(key, String(now));
                    if (window.caches) {
                      window.caches.keys().then(function(keys) {
                        return Promise.all(keys.map(function(k) { return window.caches.delete(k); }));
                      }).finally(function() {
                        window.location.reload();
                      });
                    } else {
                      window.location.reload();
                    }
                  }
                } catch(e) {
                  window.location.reload();
                }
              }

              window.addEventListener('error', function(event) {
                try {
                  if (event && event.target && event.target.tagName === 'SCRIPT') {
                    var src = event.target.src || '';
                    if (src.indexOf('/_next/static/chunks/') !== -1) {
                      handleChunkFailure();
                      return;
                    }
                  }
                  if (isChunkError(event)) {
                    handleChunkFailure();
                  }
                } catch(e) {}
              }, true);

              window.addEventListener('unhandledrejection', function(event) {
                try {
                  if (event && (isChunkError(event.reason) || isChunkError(event))) {
                    event.preventDefault();
                    handleChunkFailure();
                  }
                } catch(e) {}
              });
            })();
          `
        }} />
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
          <PushNotificationHandler />
          <GlobalNav />
          <PageWrapper>
            {children}
          </PageWrapper>
          <RefreshManager />
          <PWAInstallBanner />
        </Providers>
      </body>
    </html>
  );
}
