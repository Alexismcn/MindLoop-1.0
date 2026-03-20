import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Navigation } from "@/components/Navigation";
import { I18nProvider } from "@/lib/i18n";
import { GeoModalTrigger } from "@/components/GeoModal";
import { FooterContent } from "@/components/FooterContent";
import { ChatBot } from "@/components/ChatBot";
import { ChatProvider } from "@/lib/chat-context";

export const metadata: Metadata = {
  title: "MindScope — Mental Health Self-Assessment",
  description: "Free, anonymous mental health self-assessments for awareness and education. Not a medical tool — for informational purposes only.",
  keywords: "mental health, self-assessment, depression screening, anxiety test, wellbeing",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased">
        <I18nProvider>
          <ChatProvider>
            <Navigation />
            <GeoModalTrigger />
            {/* Extra bottom padding on mobile for the tab bar */}
            <main className="pb-20 sm:pb-0">{children}</main>
            <div className="pb-20 sm:pb-0">
              <FooterContent />
            </div>
            <ChatBot />
          </ChatProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
