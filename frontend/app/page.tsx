"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Globe,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Users,
  Award,
  CircleDot,
} from "lucide-react";

interface HealthData {
  status: string;
  db: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/health`, {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthData = await res.json();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect to backend";
      setError(msg);
      setHealth(null);
      setLastChecked(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const isConnected = health?.status === "ok" && health?.db === "connected";

  const workflowSteps = [
    { title: "Application Intake", icon: Globe, desc: "Candidate submission & verification" },
    { title: "Eligibility Engine", icon: ShieldCheck, desc: "Automated criteria validation" },
    { title: "Document Scrutiny", icon: FileCheck2, desc: "Reviewer multi-tier evaluation" },
    { title: "Selection Board", icon: Users, desc: "Committee scoring & ranking" },
    { title: "Post-Selection", icon: Award, desc: "Disbursement & tracking" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-40 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-white block leading-none text-base">
                Scholarship Admin Platform
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Unified Lifecycle Governance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <CircleDot
                className={`w-3.5 h-3.5 ${
                  loading
                    ? "text-amber-400 animate-pulse"
                    : isConnected
                    ? "text-emerald-400"
                    : "text-rose-400"
                }`}
              />
              <span className="font-mono text-[11px]">
                {loading ? "Checking..." : isConnected ? "Services Online" : "Degraded / Offline"}
              </span>
            </div>
            <button
              id="refresh-health-btn"
              onClick={fetchHealth}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              title="Refresh Health"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto px-6 py-10 w-full flex flex-col gap-10">
        {/* Hero Section */}
        <section className="text-center max-w-2xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-4">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
            Full-Stack Monorepo Active
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            Scholarship & Fellowship <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">Admin Platform</span>
          </h1>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6">
            End-to-end administration suite for national & institutional scholarship schemes. Orchestrating application screening, document scrutiny, ranking, and disbursal.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              id="launch-admin-portal-hero-btn"
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition-all"
            >
              <ShieldCheck className="w-4 h-4" />
              Launch Admin Dashboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/apply"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Award className="w-4 h-4" />
              Apply for Scholarship
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all"
            >
              Officer Login
            </Link>
          </div>
        </section>

        {/* Live Service Mesh Card */}
        <section
          id="system-health-panel"
          className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md p-6 sm:p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-400" />
                Service Health & Connectivity Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Real-time validation connecting Frontend (Next.js) → Backend (FastAPI) → Database (Postgres 16)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-500">
                {lastChecked ? `Checked: ${lastChecked}` : "Polling..."}
              </span>
              <button
                id="btn-recheck-connectivity"
                onClick={fetchHealth}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>Ping Services</span>
              </button>
            </div>
          </div>

          {/* Grid of Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
            {/* Frontend Node */}
            <div
              id="frontend-node-card"
              className="rounded-xl p-5 bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Running
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-white text-sm">Next.js 14 Frontend</h3>
                <p className="text-xs text-slate-400 mt-0.5">App Router · TypeScript · Tailwind CSS</p>
                <div className="mt-3 pt-3 border-t border-slate-800/60 font-mono text-[11px] text-slate-400 flex justify-between">
                  <span>Host:</span>
                  <span className="text-slate-200">localhost:3000</span>
                </div>
              </div>
            </div>

            {/* Backend Node */}
            <div
              id="backend-node-card"
              className="rounded-xl p-5 bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Server className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    health?.status === "ok"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : loading
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {health?.status === "ok" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Status OK
                    </>
                  ) : loading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Checking
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Unreachable
                    </>
                  )}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-white text-sm">FastAPI Backend</h3>
                <p className="text-xs text-slate-400 mt-0.5">Uvicorn · Pydantic v2 · CORS Enabled</p>
                <div className="mt-3 pt-3 border-t border-slate-800/60 font-mono text-[11px] text-slate-400 flex justify-between">
                  <span>Target API:</span>
                  <span className="text-slate-200 truncate max-w-[140px]">{apiUrl}</span>
                </div>
              </div>
            </div>

            {/* Database Node */}
            <div
              id="database-node-card"
              className="rounded-xl p-5 bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                    health?.db === "connected"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : loading
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {health?.db === "connected" ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Connected
                    </>
                  ) : loading ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> Checking
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3 h-3" /> Not Connected
                    </>
                  )}
                </span>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold text-white text-sm">PostgreSQL 16</h3>
                <p className="text-xs text-slate-400 mt-0.5">SQLAlchemy 2.0 · Alembic Engine</p>
                <div className="mt-3 pt-3 border-t border-slate-800/60 font-mono text-[11px] text-slate-400 flex justify-between">
                  <span>DB Status:</span>
                  <span
                    className={
                      health?.db === "connected"
                        ? "text-emerald-400 font-semibold"
                        : "text-rose-400 font-semibold"
                    }
                  >
                    {health?.db || "disconnected"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw payload banner */}
          <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-500">GET {apiUrl}/health</span>
              <span className="text-slate-600">→</span>
              <span className="font-mono text-indigo-300">
                {health ? JSON.stringify(health) : error ? `Error: ${error}` : "Awaiting response..."}
              </span>
            </div>
            {isConnected && (
              <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Full Stack Handshake Verified
              </span>
            )}
          </div>
        </section>

        {/* Scholarship Lifecycle Progression */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Scholarship Scheme Lifecycle Stages
            </h2>
            <span className="text-xs text-slate-500">End-to-End Governance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {workflowSteps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="rounded-xl p-4 bg-slate-900/40 border border-slate-800/70 hover:border-slate-700 transition-all group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
                      0{idx + 1}
                    </span>
                    <Icon className="w-4 h-4 text-slate-400 group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <h3 className="text-xs font-semibold text-white mb-1 flex items-center gap-1">
                    {step.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-snug">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/60 bg-slate-950/70 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span>Scholarship Admin Platform</span> ·{" "}
            <span className="text-slate-400">Foundation Scaffolding</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`${apiUrl}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              API Docs (Swagger) <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
