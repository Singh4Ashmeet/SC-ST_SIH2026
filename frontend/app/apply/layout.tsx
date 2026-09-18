"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

export default function ApplyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col antialiased">
      {/* Public Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/apply" className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-slate-900">Scholarship Portal</span>
              </Link>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/apply"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Available Schemes
              </Link>
              <Link
                href="/apply/status"
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                Track Application
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-slate-500">
            SC/ST Scholarship Portal &copy; {new Date().getFullYear()} Government of India
          </p>
        </div>
      </footer>
    </div>
  );
}