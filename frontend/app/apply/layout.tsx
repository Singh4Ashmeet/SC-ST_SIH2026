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
              <Link href="/apply" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#de5c36] to-[#e88a52] flex items-center justify-center text-white shadow-md">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-sm text-gray-900">Yojana Setu</span>
                  <span className="text-[9px] text-gray-400 block -mt-0.5">Scholarship Portal</span>
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
          <Award className="w-3 h-3 text-[#de5c36]" />
          <p className="text-xs text-gray-400">Ministry of Tribal Affairs — Scholarship Portal &copy; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}