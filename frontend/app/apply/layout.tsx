"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, Award } from "lucide-react";

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#faf8f5] text-gray-900 flex flex-col antialiased">
      {/* Public Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/apply" className="flex items-center gap-3">
                <img
                  src="/yojana-setu-logo.png"
                  alt="Yojana Setu"
                  className="h-10 w-auto object-contain"
                />
                <div className="hidden sm:flex items-center gap-2.5 border-l border-gray-300 pl-3">
                  <img
                    src="/ashoka-emblem.png"
                    alt="State Emblem of India"
                    className="h-9 w-auto object-contain"
                  />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider leading-none">
                      Govt. of India
                    </span>
                    <span className="text-[11px] text-gray-800 font-bold uppercase tracking-wider leading-tight">
                      Ministry of Tribal Affairs
                    </span>
                  </div>
                </div>
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/apply" className="text-sm font-medium text-gray-600 hover:text-[#de5c36] transition-colors">Available Schemes</Link>
              <Link href="/apply/status" className="text-sm font-medium text-gray-600 hover:text-[#de5c36] transition-colors">Track Application</Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">{children}</main>

      <footer className="border-t border-gray-200 bg-white/40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center gap-2">
          <img
            src="/ashoka-emblem.png"
            alt="State Emblem of India"
            className="h-5 w-auto object-contain"
          />
          <p className="text-xs text-gray-400">Ministry of Tribal Affairs — Scholarship Portal &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}