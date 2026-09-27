"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ShieldCheck, AlertCircle, Loader2, ArrowRight, ArrowLeft, Home, Award } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { if (!isLoading && user) router.replace("/dashboard"); }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErrorMsg(null); setIsSubmitting(true);
    try { await login({ email: email.trim(), password }); router.push("/dashboard"); }
    catch (err: unknown) { setErrorMsg(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setIsSubmitting(false); }
  };

  const fillCredentials = (quickEmail: string, quickPass: string) => { setEmail(quickEmail); setPassword(quickPass); setErrorMsg(null); };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="flex flex-col items-center gap-3"><Loader2 className="w-8 h-8 animate-spin text-[#de5c36]" /><p className="text-sm text-gray-400">Verifying session...</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#faf8f5] via-[#f5ede3] to-[#eddcd0] p-4 relative overflow-hidden">
      {/* Back to Landing Page Button */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-gray-700 hover:text-gray-950 bg-white/80 hover:bg-white border border-gray-200/90 rounded-xl shadow-sm hover:shadow transition-all backdrop-blur-md group"
          id="back-to-landing-btn"
        >
          <ArrowLeft className="w-4 h-4 text-[#de5c36] group-hover:-translate-x-1 transition-transform" />
          <span>Back to Yojana Setu</span>
        </Link>
      </div>

      {/* Ambient Shapes */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#de5c36]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-[#105a8b]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6 pt-10 sm:pt-0">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3">
            <img
              src="/yojana-setu-logo.png"
              alt="Yojana Setu Logo"
              className="h-32 sm:h-40 w-auto object-contain drop-shadow-lg"
            />
          </div>
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <div className="inline-flex items-center gap-2 bg-white/70 px-3.5 py-1.5 rounded-full border border-gray-200/80 shadow-sm">
              <img
                src="/ashoka-emblem.png"
                alt="State Emblem of India"
                className="h-6 w-auto object-contain"
              />
              <span className="text-xs font-bold text-gray-800 tracking-wide uppercase">
                Ministry of Tribal Affairs
              </span>
            </div>
            <p className="text-[11px] text-gray-500 font-medium">
              Scholarship &amp; Fellowship Administration Portal
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Portal Authentication</h2>
            <p className="text-xs text-gray-400 mt-0.5">Sign in with your administrative credentials</p>
          </div>

          {errorMsg && (
            <div id="login-error-alert" className="flex items-start gap-2 p-3 text-xs bg-rose-50 border border-rose-200 rounded-lg text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-[11px] text-gray-500 font-medium">Email Address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@tribal.gov.in" autoComplete="email"
                className="w-full mt-1 px-3 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#de5c36]/30 focus:border-[#de5c36] bg-gray-50/50" />
            </div>
            <div>
              <label htmlFor="password" className="text-[11px] text-gray-500 font-medium">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password"
                className="w-full mt-1 px-3 py-2.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#de5c36]/30 focus:border-[#de5c36] bg-gray-50/50" />
            </div>
            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating...</> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="pt-3 text-center border-t border-gray-100">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-[#de5c36] transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Yojana Setu Home</span>
            </Link>
          </div>
        </div>

        {/* Quick Access Buttons */}
        <div className="bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Quick Access (Demo)</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Super Admin", email: "admin@yojanasetu.gov.in", pass: "admin123" },
              { label: "Scheme Admin", email: "scheme_admin@yojanasetu.gov.in", pass: "scheme123" },
              { label: "Scrutiny Officer", email: "scrutiny@yojanasetu.gov.in", pass: "scrutiny123" },
              { label: "Selection Committee", email: "committee@yojanasetu.gov.in", pass: "committee123" },
            ].map((cred) => (
              <button key={cred.label} onClick={() => fillCredentials(cred.email, cred.pass)}
                className="py-2 px-3 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-700 transition text-left">
                {cred.label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">Transparency • Accuracy • Empowerment</p>
          <div className="flex items-center justify-center gap-1.5">
            <img
              src="/ashoka-emblem.png"
              alt="State Emblem of India"
              className="h-4 w-auto object-contain"
            />
            <p className="text-[10px] text-gray-400">© 2026 Ministry of Tribal Affairs — Government of India</p>
          </div>
        </div>
      </div>
    </div>
  );
}
