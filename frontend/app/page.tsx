"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, RefreshCw, Server, Database, ArrowRight, ShieldCheck, FileCheck2, Users, Award } from "lucide-react";

interface HealthData { status: string; db: string; }

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchHealth = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthData = await res.json();
      setHealth(data); setLastChecked(new Date().toLocaleTimeString());
    } catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to connect"); setHealth(null); }
    finally { setLoading(false); }
  }, [apiUrl]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const isHealthy = health?.status === "healthy" || health?.status === "ok";
  const isDbHealthy = health?.db === "connected" || health?.db === "ok";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f5ede3] to-[#eddcd0] relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute top-20 right-20 w-80 h-80 bg-[#de5c36]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-20 w-80 h-80 bg-[#105a8b]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#de5c36] to-[#e88a52] flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">Yojana Setu</span>
            <span className="text-[9px] text-gray-400 block -mt-0.5">Ministry of Tribal Affairs</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/apply" className="text-xs font-medium text-gray-600 hover:text-gray-900 transition">Apply</Link>
          <Link href="/login" className="px-4 py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition">Admin Login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-20">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 border border-gray-200 rounded-full text-[11px] font-medium text-gray-600 mb-4">
            <Award className="w-3 h-3 text-[#de5c36]" /> SIH 2026 — Smart India Hackathon
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            AI-Driven Scholarship <br /><span className="text-[#de5c36]">Verification</span> &amp; <span className="text-[#105a8b]">Scrutiny</span>
          </h1>
          <p className="text-sm text-gray-600 mt-4 max-w-xl leading-relaxed">
            A technology-driven platform for the Ministry of Tribal Affairs to process, verify, and disburse
            scholarships &amp; fellowships to Scheduled Tribe students across India with transparency and accuracy.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link href="/apply" className="px-5 py-2.5 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition flex items-center gap-2">
              Apply for Scholarship <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="px-5 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition">
              Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: FileCheck2, title: "AI Document Scrutiny", desc: "OCR-powered verification of caste certificates, income proofs, and academic records with automated deficiency detection.", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: Users, title: "Cross Scheme Check", desc: "Intelligent deduplication across multiple scholarship programs using Aadhaar-based matching to prevent double benefits.", color: "text-[#105a8b]", bg: "bg-blue-50" },
            { icon: Award, title: "Post-Selection Tracking", desc: "End-to-end management from selection to fund disbursement with renewal tracking and progress monitoring.", color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className={`w-10 h-10 rounded-full ${f.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{f.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Health */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Server className="w-4 h-4 text-gray-500" /> System Health
            </h3>
            <button onClick={fetchHealth} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> {lastChecked ? `Checked: ${lastChecked}` : "Check"}
            </button>
          </div>

          {error ? (
            <div className="flex items-center gap-2 text-xs text-rose-600"><XCircle className="w-4 h-4" /> {error}</div>
          ) : health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400">API Server</div>
                <div className={`text-sm font-bold flex items-center gap-1 mt-1 ${isHealthy ? "text-emerald-700" : "text-rose-600"}`}>
                  {isHealthy ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {health.status}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400">Database</div>
                <div className={`text-sm font-bold flex items-center gap-1 mt-1 ${isDbHealthy ? "text-emerald-700" : "text-rose-600"}`}>
                  <Database className="w-4 h-4" /> {health.db}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400">API Endpoint</div>
                <div className="text-xs font-mono text-gray-600 mt-1 truncate">{apiUrl}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="text-[10px] text-gray-400">Version</div>
                <div className="text-sm font-bold text-gray-700 mt-1">v1.0.0</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400">Checking system health...</div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/60 bg-white/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Award className="w-4 h-4 text-[#de5c36]" />
            <span>Transparency • Accuracy • Empowerment</span>
          </div>
          <p className="text-[10px] text-gray-300">© 2026 Ministry of Tribal Affairs — Government of India. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
