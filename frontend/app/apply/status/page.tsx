"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, FileText, Sparkles, AlertCircle } from "lucide-react";

export default function TrackApplicationSearchPage() {
  const router = useRouter();
  const [appId, setAppId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = appId.trim();
    if (!trimmed) {
      setError("Please enter a valid Application Reference ID");
      return;
    }
    // Clean any prefix or URL characters
    const cleanId = trimmed.includes("/") ? trimmed.split("/").pop()! : trimmed;
    router.push(`/apply/status/${cleanId}`);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 py-8">
      <Link
        href="/apply"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes
      </Link>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-[#de5c36] flex items-center justify-center mx-auto shadow-inner">
            <Search className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900">Track Scholarship Application</h1>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Enter your application reference ID to inspect automated eligibility, document scrutiny status, or your official Decision Passport.
          </p>
        </div>

        <form onSubmit={handleTrack} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5">
              Application ID (UUID)
            </label>
            <div className="relative">
              <input
                type="text"
                value={appId}
                onChange={(e) => {
                  setAppId(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 4011c1dd-860d-485c-9afc-86937d0cb9e6"
                className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#de5c36] focus:border-[#de5c36] pr-10"
              />
              <FileText className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            {error && (
              <p className="text-[11px] text-rose-600 mt-1.5 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#de5c36] hover:bg-[#c4502f] text-white font-bold text-xs rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> Track Application Status
          </button>
        </form>

        <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>Applying for a new scheme?</span>
          <Link href="/apply" className="font-bold text-[#de5c36] hover:underline">
            View Available Schemes &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
