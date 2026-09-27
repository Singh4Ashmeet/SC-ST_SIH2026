"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  getStatsOverview,
  getApplications,
  getAuditLogs,
  runDocumentScrutiny,
  type StatsOverview,
  type ApplicationRead,
  type AuditLogEntry,
} from "@/lib/api";
import {
  Files,
  AlertTriangle,
  Clock,
  UserCheck,
  ArrowRight,
  Shield,
  FileText,
  Cpu,
  Award,
  CheckCircle2,
  Sparkles,
  Sliders,
  TrendingUp,
  Inbox,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Building2,
  GraduationCap,
  Play,
  Send,
  Eye,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status.replace(/_/g, " ");

  if (s.includes("verified") || s.includes("approved") || s === "selected") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = s.includes("approved") || s === "selected" ? "Approved" : "Verified";
  } else if (s.includes("deficien")) {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Deficient";
  } else if (s.includes("scrutiny")) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    label = "Document Scrutiny";
  } else if (s === "selection") {
    cls = "bg-purple-50 text-purple-700 border-purple-200";
    label = "Selection Stage";
  } else if (s === "rejected" || s === "ineligible") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Rejected";
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  );
}

function calculateSla(createdAt: string, maxHours: number = 48) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - created) / (1000 * 60 * 60));
  const remaining = Math.max(0, maxHours - elapsed);
  let status: "ok" | "warn" | "critical" = "ok";
  if (remaining <= 6) status = "critical";
  else if (remaining <= 18) status = "warn";
  return { remaining, status, elapsed };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [applications, setApplications] = useState<ApplicationRead[]>([]);
  const [auditItems, setAuditItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [s, apps, audit] = await Promise.all([
        getStatsOverview(),
        getApplications({ page_size: 50 }),
        getAuditLogs({ page_size: 10 }),
      ]);
      setStats(s);
      setApplications(apps);
      setAuditItems(audit.items || []);
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const role = user?.role || "SUPER_ADMIN";
  const roleTitle = role.replace(/_/g, " ");

  const totalApps = stats?.total_applications ?? applications.length;
  const deficientCount = stats?.deficient_count ?? applications.filter((a) => a.current_state === "deficient").length;
  const scrutinyApps = useMemo(
    () => applications.filter((a) => a.current_state === "document_scrutiny" || a.current_state === "submitted"),
    [applications]
  );
  const selectionApps = useMemo(
    () => applications.filter((a) => a.current_state === "selection" || a.current_state === "pending_selection"),
    [applications]
  );
  const instituteApps = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.current_state === "eligibility_check" ||
          a.current_state === "institute_verification" ||
          a.current_state === "document_scrutiny"
      ),
    [applications]
  );
  const approvedApps = useMemo(
    () => applications.filter((a) => a.current_state === "approved" || a.current_state === "visa_issued"),
    [applications]
  );



  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          <span className="text-xs text-stone-500 font-medium">Loading role dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── ROLE BANNER WITH LOGO ── */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-xl p-6 text-white shadow-lg border border-stone-700/50 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <img
              src="/yojana-setu-logo.png"
              alt="Yojana Setu"
              className="h-16 w-auto object-contain bg-white/10 p-1.5 rounded-xl shadow-md border border-white/15 hidden sm:block"
            />
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#de5c36] text-white text-[10px] font-bold tracking-wider uppercase rounded-full shadow-sm">
                <UserCheck className="w-3.5 h-3.5" />
                Active Officer Role: {roleTitle}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Welcome, {user?.full_name || user?.email}
              </h1>
              <div className="flex items-center gap-2 pt-0.5">
                <img
                  src="/emblem-white.png"
                  alt="State Emblem of India"
                  className="h-5 w-auto object-contain shrink-0"
                />
                <p className="text-xs text-stone-300 max-w-xl">
                  Ministry of Tribal Affairs — AI-Enabled Tribal Scholarship &amp; Fellowship Management Console.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-stone-800/90 border border-stone-700 p-3.5 rounded-lg text-xs space-y-1 max-w-xs">
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
              Official Role Mandate
            </div>
            <p className="text-stone-300 text-[11px] leading-relaxed">
              {role === "SCRUTINY_OFFICER" &&
                "Examine certificate validity, review EfficientNet-B0 document classifier predictions, verify RapidOCR fields, and issue deficiency notices."}
              {role === "SELECTION_COMMITTEE" &&
                "Evaluate verified candidates against academic criteria, review merit ranking scores, and award grants or fellowships."}
              {role === "INSTITUTE_VERIFIER" &&
                "Confirm bona fide enrollment, academic course registration, and attendance records from participating universities."}
              {role === "NODAL_OFFICER" &&
                "District/State administrative oversight, inter-departmental grievance escalation, and workflow SLA compliance."}
              {role === "SCHEME_ADMIN" &&
                "Configure dynamic scheme rules, document requirements, and execute policy simulations."}
              {role === "SUPER_ADMIN" &&
                "Full operational oversight, multi-scheme analytics, tamper-evident audit logs, and global user management."}
            </p>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{actionFeedback}</span>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            ×
          </button>
        </div>
      )}

      {/* ── 1. SCRUTINY OFFICER VIEW ── */}
      {(role === "SCRUTINY_OFFICER" || role === "SUPER_ADMIN") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[#de5c36]" />
              <h2 className="text-base font-bold text-stone-900">Document Scrutiny Workbench</h2>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                {scrutinyApps.length} Cases Requiring Scrutiny
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/scrutiny"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#de5c36] hover:underline"
              >
                Open Scrutiny Queue <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Under Scrutiny</div>
                <div className="text-xl font-bold text-stone-900">{scrutinyApps.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Deficient Cases</div>
                <div className="text-xl font-bold text-stone-900">{deficientCount}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Active Applications</div>
                <div className="text-xl font-bold text-stone-900">{totalApps}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Passed to Selection</div>
                <div className="text-xl font-bold text-stone-900">{selectionApps.length}</div>
              </div>
            </div>
          </div>

          {/* Quick-Action Scrutiny Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-3.5 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Pending Scrutiny Action Items (Interactive Console)
              </span>
              <span className="text-[11px] text-stone-500">Click &ldquo;Scrutinize Case&rdquo; to execute officer actions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-100/60 text-stone-600 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-2.5">Case ID</th>
                    <th className="px-4 py-2.5">Applicant</th>
                    <th className="px-4 py-2.5">Stage</th>
                    <th className="px-4 py-2.5">Officer SLA</th>
                    <th className="px-4 py-2.5 text-right">Direct Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {scrutinyApps.slice(0, 4).map((app) => {
                    const sla = calculateSla(app.created_at, 48);
                    return (
                      <tr key={app.id} className="hover:bg-amber-50/30">
                        <td className="px-4 py-3 font-mono font-semibold text-stone-900">
                          #{app.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-900">
                          {app.applicant_name}
                          <div className="text-[10px] text-stone-500">{app.applicant_email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={app.current_state} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                              sla.status === "critical"
                                ? "text-rose-700"
                                : sla.status === "warn"
                                ? "text-amber-700"
                                : "text-emerald-700"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {sla.remaining}h remaining
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/scrutiny/${app.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#de5c36] hover:bg-[#c44a26] text-white font-bold rounded-lg text-[11px] shadow-sm transition active:scale-95"
                          >
                            Scrutinize Case <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. SELECTION COMMITTEE VIEW ── */}
      {(role === "SELECTION_COMMITTEE" || role === "SUPER_ADMIN") && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-stone-900">Selection Committee Queue</h2>
              <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                {selectionApps.length} Candidates Pending Award
              </span>
            </div>
            <Link
              href="/dashboard/selection"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:underline"
            >
              Open Selection Queue <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Awaiting Committee Vote</div>
                <div className="text-xl font-bold text-stone-900">{selectionApps.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Fellowships Awarded</div>
                <div className="text-xl font-bold text-stone-900">{approvedApps.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Top Merit Candidates</div>
                <div className="text-xl font-bold text-stone-900">{Math.min(selectionApps.length, 10)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. INSTITUTE VERIFIER VIEW ── */}
      {(role === "INSTITUTE_VERIFIER" || role === "NODAL_OFFICER" || role === "SUPER_ADMIN") && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-stone-900">Institute Verification Queue</h2>
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full border border-blue-200">
                Institutional Validation
              </span>
            </div>
            <Link
              href="/dashboard/applications?queue=institute"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline"
            >
              View Enrolled Scholars <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Scholars Under Verification</div>
                <div className="text-xl font-bold text-stone-900">{instituteApps.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Institution Confirmed</div>
                <div className="text-xl font-bold text-stone-900">{approvedApps.length}</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-medium text-stone-500">Bonafide Check Needed</div>
                <div className="text-xl font-bold text-stone-900">{deficientCount}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ALL ASSIGNED CASE FILES TABLE ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Active Application Case Files</h3>
            <p className="text-xs text-stone-500">
              Interactive portal connected to state machine, OCR, and Document Classifier.
            </p>
          </div>
          <Link href="/dashboard/applications" className="text-xs font-semibold text-[#de5c36] hover:underline">
            View All ({applications.length})
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center text-stone-500 space-y-2">
            <Inbox className="w-8 h-8 text-stone-400 mx-auto" />
            <p className="text-xs">No active applications currently assigned.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100/70 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Applicant</th>
                  <th className="px-4 py-3">Scheme</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Officer SLA Timer</th>
                  <th className="px-4 py-3 text-right">Work Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-stone-800">
                {applications.slice(0, 8).map((app) => {
                  const sla = calculateSla(app.created_at, 48);
                  return (
                    <tr key={app.id} className="hover:bg-amber-50/30 transition">
                      <td className="px-4 py-3 font-mono font-semibold text-stone-900">
                        #{app.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-medium text-stone-900">
                        {app.applicant_name}
                        <div className="text-[10px] text-stone-500">{app.applicant_email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-[10px] bg-stone-100 text-stone-700 px-2 py-0.5 rounded border border-stone-300">
                          {app.scheme_id ? "NFST/NOS" : "SCHEME"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={app.current_state} />
                      </td>
                      <td className="px-4 py-3 text-stone-500">
                        <div className="flex items-center gap-1">
                          <Clock
                            className={`w-3.5 h-3.5 ${
                              sla.status === "critical"
                                ? "text-rose-500"
                                : sla.status === "warn"
                                ? "text-amber-500"
                                : "text-emerald-500"
                            }`}
                          />
                          <span
                            className={
                              sla.status === "critical"
                                ? "text-rose-700 font-bold"
                                : sla.status === "warn"
                                ? "text-amber-700 font-semibold"
                                : "text-stone-600"
                            }
                          >
                            {sla.remaining}h remaining
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {app.current_state === "document_scrutiny" || app.current_state === "deficient" ? (
                          <Link
                            href={`/dashboard/scrutiny/${app.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-[#de5c36] hover:bg-[#c44a26] text-white font-semibold rounded text-[11px] transition shadow-sm"
                          >
                            Scrutiny Review <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : app.current_state === "selection" ? (
                          <Link
                            href={`/dashboard/selection/${app.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded text-[11px] transition shadow-sm"
                          >
                            Committee Vote <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/applications/${app.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded text-[11px] transition shadow-sm"
                          >
                            Open Case File <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── LIVE AUDIT STREAM ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-stone-700" />
            <h3 className="text-xs font-bold text-stone-900">Live Cryptographic Audit Activity Feed</h3>
          </div>
          <span className="text-[10px] text-stone-500 font-mono">SHA-256 Merkle Provenance</span>
        </div>

        <div className="space-y-2">
          {auditItems.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between text-xs p-2 rounded bg-stone-50 border border-stone-200/60"
            >
              <div className="space-y-0.5">
                <span className="font-semibold text-stone-900 uppercase text-[10px] px-1.5 py-0.5 rounded bg-stone-200">
                  {item.action}
                </span>
                <p className="text-[11px] text-stone-600 mt-1">
                  Transitioned state from <code className="text-stone-800">{item.from_state || "start"}</code> to{" "}
                  <code className="text-stone-800">{item.to_state || "next"}</code>
                </p>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">
                {item.created_at ? new Date(item.created_at).toLocaleTimeString() : "Recent"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
