import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { ToastProvider } from "@/components/feedback/ToastProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

// Plus Jakarta Sans — modern, friendly. Used for body and headings.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

const TITLE = "DormDrop — 24/7 Student Delivery at University of Southampton";
const DESCRIPTION =
  "Get snacks, drinks, and essentials delivered to your door by fellow students. Any time, any day.";

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: "%s · DormDrop",
  },
  description: DESCRIPTION,
  metadataBase: new URL(APP_URL),
  applicationName: "DormDrop",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DormDrop",
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: "DormDrop",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#064e3b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen font-sans">
        <ErrorBoundary>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
