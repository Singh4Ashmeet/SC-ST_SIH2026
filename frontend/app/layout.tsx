import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/app/providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Yojana Setu | Ministry of Tribal Affairs — Scholarship & Fellowship Management System",
  description:
    "AI-enabled Scholarship and Fellowship Management System for end-to-end administration of MoTA schemes for Scheduled Tribe students — application management, eligibility verification, document scrutiny, selection, and post-selection tracking.",
  keywords: "MoTA, Ministry of Tribal Affairs, Scholarship, Fellowship, NFST, NOS, ST Students, Yojana Setu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#f5f3ef] text-gray-800 font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
