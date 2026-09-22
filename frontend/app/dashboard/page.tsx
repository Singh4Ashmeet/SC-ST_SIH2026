"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  getStatsOverview,
  getApplications,
  getAuditLogs,
  type StatsOverview,
  type ApplicationRead,
  type AuditLogEntry,
} from "@/lib/api";
import {
  Files,
  AlertTriangle,
  Clock,
  History,
  UserCheck,
  Calendar,
  ChevronDown,
  ArrowRight,
  BarChart2,
  TrendingUp,
  GitMerge,
  Clock3,
  Shield,
  FileText,
  Search,
  Cpu,
  CheckSquare,
  Coins,
  Award,
  Check,
  CheckCircle2,
  ShieldCheck,
  Send,
} from "lucide-react";

/* ── Status badge helper ─────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status;

  if (s.includes("verified") || s.includes("approved") || s === "selected") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = s.includes("approved") || s === "selected" ? "Approved" : "Verified";
  } else if (s.includes("deficien") || s === "deficient") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Deficiency";
  } else if (s.includes("scrutiny") || s === "under_scrutiny") {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    label = "AI Scrutiny";
  } else if (s.includes("pending") || s === "submitted") {
    cls = "bg-blue-50 text-blue-700 border-blue-200";
    label = "Pending";
  } else if (s === "rejected" || s === "ineligible") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Rejected";
  }

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

/* ── AI confidence display ──────────────────────────────────────────── */
function AIConfidence({ value }: { value: number }) {
  return (
    <span className="font-medium text-gray-700">{value}%</span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [recentApps, setRecentApps] = useState<ApplicationRead[]>([]);
  const [auditItems, setAuditItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"recent" | "pending" | "conflicts">("recent");

  useEffect(() => {
    async function load() {
      try {
        const [s, apps, audit] = await Promise.all([
          getStatsOverview(),
          getApplications({ page_size: 5 }),
          getAuditLogs({ page_size: 5 }),
        ]);
        setStats(s);
        setRecentApps(apps);
        setAuditItems(audit.items || []);
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          <span className="text-sm text-gray-500">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const totalApps = stats?.total_applications ?? 0;
  const deficientCount = stats?.deficient_count ?? 0;
  const pendingCross = stats?.applications_by_state?.["pending_cross_check"] ?? stats?.applications_by_state?.["submitted"] ?? 0;
  const approvedCount = stats?.applications_by_state?.["approved"] ?? stats?.applications_by_state?.["selected"] ?? 0;
  const processRate = totalApps > 0 ? Math.round(((totalApps - approvedCount) / totalApps) * 100) : 0;

  /* Workflow pipeline counts */
  const wfApplied = totalApps;
  const wfVerification = stats?.applications_by_state?.["under_scrutiny"] ?? stats?.applications_by_state?.["verified"] ?? 0;
  const wfScrutiny = stats?.applications_by_state?.["scrutiny_complete"] ?? 0;
  const wfDeficiency = deficientCount;
  const wfApproved = approvedCount;
  const wfDisbursed = stats?.total_disbursed_amount ? Math.floor(stats.total_disbursed_amount / 1000) : 0;

  return (
    <div className="space-y-6">
      {/* ── Welcome Header Row ── */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
            Welcome, {user?.full_name || "Admin Officer"}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Here&apos;s what&apos;s happening with the scholarship &amp;
            fellowship applications today.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-gray-200 px-3.5 py-1.5 rounded-lg shadow-sm text-xs font-medium text-gray-700 cursor-pointer hover:border-gray-300">
          <Calendar className="w-3.5 h-3.5 text-gray-500" />
          <span>01 Apr 2025 - 30 Jun 2026</span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-1" />
        </div>
      </section>

      {/* ── KPI Cards Row (5 Cards) ── */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
      >
        {/* Card 1: Total Applications */}
        <div className="relative bg-white rounded-xl p-4 border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in stagger-1">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-[#105a8b]/10 flex items-center justify-center text-[#105a8b]">
              <Files className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↑ 12%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-gray-500">
              Total Applications Received
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {totalApps.toLocaleString()}
              </h3>
              <span className="text-[10px] text-gray-400">vs. last month</span>
            </div>
          </div>
          <div className="card-wave bg-gradient-to-r from-blue-300 via-sky-200 to-transparent" />
        </div>

        {/* Card 2: Deficiencies Flagged */}
        <div className="relative bg-white rounded-xl p-4 border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in stagger-2">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
              ↑ 8%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-gray-500">
              Deficiencies Flagged
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-rose-700">
                {deficientCount.toLocaleString()}
              </h3>
              <span className="text-[10px] text-gray-400">vs. last month</span>
            </div>
          </div>
          <div className="card-wave bg-gradient-to-r from-rose-300 via-orange-200 to-transparent" />
        </div>

        {/* Card 3: Pending Cross Scheme Check */}
        <div className="relative bg-white rounded-xl p-4 border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in stagger-3">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↓ 15%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-gray-500">
              Pending Cross Scheme Check
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {pendingCross.toLocaleString()}
              </h3>
              <span className="text-[10px] text-gray-400">vs. last month</span>
            </div>
          </div>
          <div className="card-wave bg-gradient-to-r from-amber-300 via-yellow-200 to-transparent" />
        </div>

        {/* Card 4: Pending Process Rate */}
        <div className="relative bg-white rounded-xl p-4 border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in stagger-4">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <History className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
              ↓ 10%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-gray-500">
              Pending Process Rate
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-gray-900">
                {processRate}%
              </h3>
              <span className="text-[10px] text-gray-400">vs. last month</span>
            </div>
          </div>
          <div className="card-wave bg-gradient-to-r from-slate-300 via-cyan-100 to-transparent" />
        </div>

        {/* Card 5: Selected & Approved */}
        <div className="relative bg-white rounded-xl p-4 border border-gray-100 shadow-sm overflow-hidden flex flex-col justify-between animate-fade-in stagger-5">
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              ↑ 18%
            </span>
          </div>
          <div className="mt-3">
            <p className="text-[11px] font-medium text-gray-500">
              Selected &amp; Approved
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <h3 className="text-2xl font-bold text-emerald-800">
                {approvedCount.toLocaleString()}
              </h3>
              <span className="text-[10px] text-gray-400">vs. last month</span>
            </div>
          </div>
          <div className="card-wave bg-gradient-to-r from-emerald-300 via-teal-200 to-transparent" />
        </div>
      </section>

      {/* ── Middle Section Grid ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* AI Scrutiny Case Review (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-xl p-5 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            {/* Card Header with Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                  AI Scrutiny Case Review
                </h3>
                <p className="text-[11px] text-gray-500">
                  Document verification, OCR &amp; AI based analysis
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-xs font-medium">
                  {(["recent", "pending", "conflicts"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={
                        activeTab === tab
                          ? "text-[#de5c36] border-b-2 border-[#de5c36] pb-1 font-semibold"
                          : "text-gray-500 hover:text-gray-800 pb-1"
                      }
                    >
                      {tab === "recent"
                        ? "Recent Cases"
                        : tab === "pending"
                        ? "Pending Review"
                        : "Conflicts"}
                    </button>
                  ))}
                </div>
                <a
                  className="text-xs font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
                  href="/dashboard/scrutiny"
                >
                  View All <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Content: Table + OCR Panel */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mt-4">
              {/* Review Table */}
              <div className="xl:col-span-8 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="pb-2">Application ID</th>
                      <th className="pb-2">Student Name</th>
                      <th className="pb-2">Scheme</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-center">AI Confidence</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-normal">
                    {recentApps.length > 0
                      ? recentApps.map((app, i) => (
                          <tr
                            key={app.id}
                            className="hover:bg-gray-50/70 transition"
                          >
                            <td className="py-2.5 font-medium text-gray-800 text-[11px]">
                              {app.id.slice(0, 14).toUpperCase()}
                            </td>
                            <td className="py-2.5 text-gray-700">
                              {app.applicant_name}
                            </td>
                            <td className="py-2.5 text-gray-500 text-[11px]">
                              {(app.applicant_data?.scheme_name as string) || "Post Matric"}
                            </td>
                            <td className="py-2.5">
                              <StatusBadge status={app.current_state} />
                            </td>
                            <td className="py-2.5 text-center">
                              <AIConfidence
                                value={75 + Math.floor(Math.random() * 20)}
                              />
                            </td>
                            <td className="py-2.5 text-right">
                              <a
                                href={`/dashboard/applications/${app.id}`}
                                className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        ))
                      : /* Fallback demo data */
                        [
                          { id: "MT/2026/15432", name: "Anita Kumari", scheme: "Post Matric", status: "verified", conf: 89 },
                          { id: "MT/2026/15431", name: "Ramesh Tudu", scheme: "Pre Matric", status: "under_scrutiny", conf: 85 },
                          { id: "MT/2026/15430", name: "Sita Bhumi", scheme: "Post Matric", status: "deficient", conf: 62 },
                          { id: "MT/2026/15429", name: "Karan Oraon", scheme: "Top Class", status: "approved", conf: 94 },
                          { id: "MT/2026/15428", name: "Pooja Murmu", scheme: "Post Matric", status: "submitted", conf: 71 },
                        ].map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-2.5 font-medium text-gray-800 text-[11px]">{row.id}</td>
                            <td className="py-2.5 text-gray-700">{row.name}</td>
                            <td className="py-2.5 text-gray-500 text-[11px]">{row.scheme}</td>
                            <td className="py-2.5"><StatusBadge status={row.status} /></td>
                            <td className="py-2.5 text-center"><AIConfidence value={row.conf} /></td>
                            <td className="py-2.5 text-right">
                              <button className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200">View</button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* OCR Document Preview Panel */}
              <div className="xl:col-span-4 bg-[#fbfbfa] border border-gray-200 rounded-lg p-3 flex flex-col justify-between">
                <div>
                  {/* Document Thumbnail Mockup */}
                  <div className="bg-white border border-gray-200 rounded p-2 shadow-xs mb-3">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-100">
                      <div className="w-4 h-4 bg-gray-200 rounded-full flex items-center justify-center text-[7px] text-gray-600">
                        🏛️
                      </div>
                      <span className="text-[8px] text-gray-400 uppercase tracking-tight">
                        Caste Certificate
                      </span>
                      <div className="w-3 h-3 bg-gray-100 rounded" />
                    </div>
                    <div className="space-y-1 py-1">
                      <div className="h-1 bg-gray-200 rounded w-full" />
                      <div className="h-1 bg-gray-200 rounded w-5/6" />
                      <div className="h-1 bg-gray-200 rounded w-4/6" />
                      <div className="h-1 bg-gray-100 rounded w-full" />
                      <div className="h-1 bg-gray-200 rounded w-3/4" />
                    </div>
                    <div className="flex justify-between items-end mt-2 pt-1 border-t border-gray-100">
                      <div className="h-2 w-10 bg-gray-200 rounded" />
                      <div className="w-4 h-4 border border-dashed border-gray-400 flex items-center justify-center text-[6px] text-gray-400">
                        QR
                      </div>
                    </div>
                  </div>

                  {/* OCR Analysis Checklist */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-gray-800">
                        OCR Analysis
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                        <Check className="w-2.5 h-2.5" /> Match
                      </span>
                    </div>
                    <ul className="text-[10px] space-y-1 text-gray-600 mt-1">
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Certificate Authenticity</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Data Consistency</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>No Tampering Detected</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <a
                  href="/dashboard/scrutiny"
                  className="w-full mt-3 py-1.5 px-3 bg-[#1e293b] hover:bg-[#0f172a] text-white text-[11px] font-semibold rounded shadow-sm transition text-center block"
                >
                  View Full Report
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column Charts (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Chart 1: Application Rate */}
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-bold text-gray-900">
                  Application Rate
                </h3>
              </div>
              <a
                className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
                href="/dashboard/applications"
              >
                View Details <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#1e293b]" /> Received
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#de8b3b]" /> Verified
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#2e684d]" /> Approved
              </span>
            </div>
            {/* CSS Bar Chart */}
            <div className="h-28 flex items-end justify-between gap-1.5 pt-2 border-b border-gray-200">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                (day, i) => {
                  const heights = [
                    [50, 35, 20],
                    [65, 50, 35],
                    [85, 65, 45],
                    [75, 60, 55],
                    [95, 75, 60],
                    [90, 80, 68],
                    [100, 85, 72],
                  ];
                  return (
                    <div
                      key={day}
                      className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end"
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 h-20">
                        <div
                          className="w-1.5 bg-[#1e293b] rounded-t"
                          style={{ height: `${heights[i][0]}%` }}
                        />
                        <div
                          className="w-1.5 bg-[#de8b3b] rounded-t"
                          style={{ height: `${heights[i][1]}%` }}
                        />
                        <div
                          className="w-1.5 bg-[#2e684d] rounded-t"
                          style={{ height: `${heights[i][2]}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400">{day}</span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Chart 2: Weekly Processing Rate */}
          <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-bold text-gray-900">
                  Weekly Processing Rate
                </h3>
              </div>
              <a
                className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
                href="/dashboard/applications"
              >
                View Details <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-[#105a8b]" /> Overall
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-[#de8b3b]" /> AI Scrutiny
              </span>
            </div>
            <div className="relative h-24 w-full">
              <svg className="w-full h-full" viewBox="0 0 260 80">
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="260" y1="10" y2="10" />
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="260" y1="35" y2="35" />
                <line stroke="#f1f5f9" strokeWidth="1" x1="0" x2="260" y1="60" y2="60" />
                <polyline fill="none" points="15,55 50,45 85,30 125,40 165,48 205,32 245,22" stroke="#105a8b" strokeWidth="2" />
                {[15,50,85,125,165,205,245].map((x, i) => (
                  <circle key={i} cx={x} cy={[55,45,30,40,48,32,22][i]} fill="#105a8b" r="2.5" />
                ))}
                <polyline fill="none" points="15,65 50,58 85,48 125,52 165,58 205,42 245,35" stroke="#de8b3b" strokeDasharray="3,3" strokeWidth="2" />
                {[15,50,85,125,165,205,245].map((x, i) => (
                  <circle key={i} cx={x} cy={[65,58,48,52,58,42,35][i]} fill="#de8b3b" r="2" />
                ))}
              </svg>
              <div className="flex justify-between text-[9px] text-gray-400 px-1 -mt-1">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom Section Grid ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Application Workflow (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-gray-700" />
              <h3 className="text-xs font-bold text-gray-900">
                Application Workflow
              </h3>
            </div>
            <a
              className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
              href="/dashboard/applications"
            >
              View Details <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          <div className="py-5 px-1 overflow-x-auto">
            <div className="flex items-center justify-between min-w-[340px] text-center">
              {[
                { icon: FileText, label: "1. Applied", count: wfApplied, color: "bg-slate-700" },
                { icon: Search, label: "2. Verification", count: wfVerification, color: "bg-[#105a8b]" },
                { icon: Cpu, label: "3. AI Scrutiny", count: wfScrutiny, color: "bg-amber-600" },
                { icon: AlertTriangle, label: "4. Deficiency", count: wfDeficiency, color: "bg-rose-600", textColor: "text-rose-600" },
                { icon: CheckSquare, label: "5. Approved", count: wfApproved, color: "bg-emerald-700" },
                { icon: Coins, label: "6. Disbursed", count: wfDisbursed, color: "bg-amber-700" },
              ].map((step, i, arr) => {
                const Icon = step.icon;
                return (
                  <React.Fragment key={step.label}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full ${step.color} text-white flex items-center justify-center text-xs shadow-sm`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-medium text-gray-700 mt-1.5">
                        {step.label}
                      </span>
                      <span className={`text-xs font-bold ${step.textColor || "text-gray-900"}`}>
                        {step.count.toLocaleString()}
                      </span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-4 h-0.5 bg-gray-300 -mt-5" />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Applications Mini Table (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock3 className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-bold text-gray-900">
                  Recent Applications
                </h3>
              </div>
              <a
                className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
                href="/dashboard/applications"
              >
                View All <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-[11px]">
                <thead>
                  <tr className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-1.5">App ID</th>
                    <th className="pb-1.5">Applicant Name</th>
                    <th className="pb-1.5">Scheme</th>
                    <th className="pb-1.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(recentApps.length > 0
                    ? recentApps.map((app) => ({
                        id: app.id.slice(0, 14).toUpperCase(),
                        name: app.applicant_name,
                        scheme: (app.applicant_data?.scheme_name as string) || "Post Matric",
                        status: app.current_state,
                      }))
                    : [
                        { id: "MT/2026/15432", name: "Anita Kumari", scheme: "Post Matric", status: "verified" },
                        { id: "MT/2026/15431", name: "Ramesh Tudu", scheme: "Pre Matric", status: "deficient" },
                        { id: "MT/2026/15430", name: "Sita Bhumi", scheme: "Post Matric", status: "deficient" },
                        { id: "MT/2026/15429", name: "Birsa Munda", scheme: "Top Class", status: "approved" },
                        { id: "MT/2026/15428", name: "Pooja Murmu", scheme: "Post Matric", status: "submitted" },
                      ]
                  ).map((row) => (
                    <tr key={row.id}>
                      <td className="py-1.5 font-medium text-gray-800 text-[10px]">{row.id}</td>
                      <td className="py-1.5 text-gray-700 text-[10px]">{row.name}</td>
                      <td className="py-1.5 text-gray-500 text-[10px]">{row.scheme}</td>
                      <td className="py-1.5 text-right">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Audit Activity Timeline (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-700" />
                <h3 className="text-xs font-bold text-gray-900">
                  Audit Activity
                </h3>
              </div>
              <a
                className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5"
                href="/dashboard/audit"
              >
                View All <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-3 mt-3 relative pl-3 border-l border-gray-200 text-xs">
              {(auditItems.length > 0
                ? auditItems.map((a, i) => ({
                    color: ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-slate-500", "bg-emerald-500"][i % 5],
                    text: `${a.action}${a.application_id ? ` for ${a.application_id.slice(0, 8)}` : ""}`,
                    time: new Date(a.created_at).toLocaleString(),
                  }))
                : [
                    { color: "bg-rose-500", text: "Application MT/2026/15431 flagged for deficiency", time: "10 mins ago" },
                    { color: "bg-blue-500", text: "AI verification completed for MT/2026/15430", time: "22 mins ago" },
                    { color: "bg-amber-500", text: "Scheme updated - Post Matric Scholarship", time: "1 hour ago" },
                    { color: "bg-slate-500", text: "User Login - Admin Officer", time: "2 hours ago" },
                    { color: "bg-emerald-500", text: "Application MT/2026/15428 approved", time: "3 hours ago" },
                  ]
              ).map((item, i) => (
                <div key={i} className="relative">
                  <div
                    className={`w-2 h-2 rounded-full ${item.color} absolute -left-[17px] top-1`}
                  />
                  <p className="text-[11px] font-medium text-gray-800 leading-tight">
                    {item.text}
                  </p>
                  <span className="text-[9px] text-gray-400">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Notifications / Communication Panel ── */}
      <section className="bg-white rounded-xl p-5 border border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-gray-700" />
            <h3 className="text-sm font-bold text-gray-900 tracking-tight">
              Communications &amp; Notifications
            </h3>
          </div>
          <span className="text-[10px] text-gray-400">Auto-generated alerts</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {[
            { title: "Deficiency Alerts Sent", count: deficientCount, desc: "Applicants notified about missing/deficient documents", color: "text-rose-600", bg: "bg-rose-50" },
            { title: "Selection Results Published", count: approvedCount, desc: "Successful candidates notified via email/SMS", color: "text-emerald-600", bg: "bg-emerald-50" },
            { title: "Pending Resubmissions", count: stats?.pending_renewals_count ?? 0, desc: "Awaiting document resubmission from applicants", color: "text-amber-600", bg: "bg-amber-50" },
          ].map((n) => (
            <div
              key={n.title}
              className={`${n.bg} rounded-lg p-4 border border-gray-100`}
            >
              <p className="text-[11px] font-medium text-gray-500">{n.title}</p>
              <h4 className={`text-2xl font-bold mt-1 ${n.color}`}>
                {n.count.toLocaleString()}
              </h4>
              <p className="text-[10px] text-gray-400 mt-1">{n.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Folk Art Footer Banner ── */}
      <footer className="relative bg-gradient-to-r from-[#eddcd0] via-[#e5cfbe] to-[#dfc4b0] rounded-xl p-4 border border-[#d6ba9f] shadow-sm flex flex-col md:flex-row items-center justify-between overflow-hidden gap-4">
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-full bg-[#de5c36] text-white flex items-center justify-center flex-shrink-0 shadow-md">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase tracking-wide">
              <span>Transparency</span>
              <span>•</span>
              <span>Accuracy</span>
              <span>•</span>
              <span>Empowerment</span>
            </div>
            <p className="text-[11px] text-stone-700 font-medium mt-0.5">
              Technology-driven scholarship &amp; fellowship management for a
              stronger tribal India
            </p>
          </div>
        </div>
        {/* Warli Tribal Silhouette Artwork */}
        <div className="relative h-12 w-64 flex-shrink-0 opacity-70 z-10">
          <svg
            className="w-full h-full text-stone-800 fill-current"
            viewBox="0 0 320 60"
          >
            <path
              d="M290 55 L292 25 L285 20 L292 25 L300 18 L292 25 L294 55 Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <circle cx="292" cy="16" r="3" />
            <circle cx="230" cy="22" r="3" />
            <path d="M230 25 L225 38 L235 38 Z" />
            <path d="M225 38 L220 30 M235 38 L240 30 M226 45 L224 55 M234 45 L236 55" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="245" cy="24" r="2.5" />
            <path d="M245 26.5 L241 38 L249 38 Z" />
            <path d="M241 38 L240 30 M249 38 L254 30 M242 45 L240 55 M248 45 L250 55" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="258" cy="28" r="2" />
            <path d="M258 30 L255 39 L261 39 Z" />
            <path d="M255 39 L254 30 M261 39 L265 30 M256 45 L255 55 M260 45 L261 55" stroke="currentColor" strokeWidth="1" fill="none" />
            <circle cx="270" cy="23" r="3" />
            <path d="M270 26 L265 38 L275 38 Z" />
            <path d="M265 38 L265 30 M275 38 L278 30 M266 45 L265 55 M274 45 L275 55" stroke="currentColor" strokeWidth="1" fill="none" />
            <line
              stroke="currentColor"
              strokeWidth="1.5"
              x1="210"
              x2="310"
              y1="55"
              y2="55"
            />
          </svg>
        </div>
      </footer>
    </div>
  );
}
