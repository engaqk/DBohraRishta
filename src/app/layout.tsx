import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DBohraRishta | Intentional Matchmaking for the Dawoodi Bohra Community",
  description: "A high-performance, community-centric matchmaking platform for the Dawoodi Bohra community, focusing on Rishta (Alliance) as the primary goal.",
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
          {children}
        </Providers>
      </body>
    </html>
  );
}
