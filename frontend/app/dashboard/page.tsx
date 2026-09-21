"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  IndianRupee,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import { getApplications, getAuditLogs, getStatsOverview, type ApplicationRead, type AuditLogListResponse, type StatsOverview } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const C = {
  navy: "#0A0F1E",
  green: "#1B4332",
  terracotta: "#A64B2C",
  gold: "#E09E18",
  cream: "#F1E4C9",
  slate: "#5A6B7F",
  ochre: "#BF8F35",
  paper: "#FAF8F4",
};

const FALLBACK_STATS = {
  total_applications: 8410,
  deficient_count: 412,
  pending_disbursements_count: 89,
  total_disbursed_amount: 68400000,
  pending_renewals_count: 69,
};

const FALLBACK_CASES = [
  { name: "Birsa Munda", scheme: "NFST", status: "Pending Review", flag: "Deficient Document · Caste Certificate", score: 80, tone: "warning" },
  { name: "Tanvi Kamble", scheme: "NFST", status: "Verified", flag: "All required documents matched", score: 96, tone: "success" },
  { name: "Rohan Minz", scheme: "NOS", status: "Needs Attention", flag: "Admission offer requires review", score: 72, tone: "danger" },
];

const WEEKLY = [
  { day: "Mon", received: 680, verified: 410, pending: 230 },
  { day: "Tue", received: 1110, verified: 690, pending: 370 },
  { day: "Wed", received: 740, verified: 520, pending: 300 },
  { day: "Thu", received: 1030, verified: 760, pending: 460 },
  { day: "Fri", received: 1010, verified: 810, pending: 510 },
];

function money(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "success" | "warning" | "danger" | "neutral" }) {
  const styles = {
    success: { background: "#1B4332", color: "#F1E4C9" },
    warning: { background: "#E09E18", color: "#0A0F1E" },
    danger: { background: "#A64B2C", color: "#FAF8F4" },
    neutral: { background: "#5A6B7F", color: "#FAF8F4" },
  }[tone];

  return <span style={styles} className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold">{children}</span>;
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "green" | "gold" | "terracotta" | "navy";
}) {
  const accents = {
    green: C.green,
    gold: C.gold,
    terracotta: C.terracotta,
    navy: C.navy,
  };
  const accent = accents[tone];

  return (
    <div className="rounded-xl border p-4 shadow-[0_3px_12px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: C.slate }}>{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: C.navy }}>{value}</p>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: `${accent}16`, color: accent }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-[11px]" style={{ color: C.slate }}>{note}</p>
    </div>
  );
}

function BarChart() {
  const max = Math.max(...WEEKLY.map((x) => x.received));
  return (
    <div className="mt-5 flex h-44 items-end justify-between gap-3">
      {WEEKLY.map((item) => (
        <div key={item.day} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div className="flex h-full w-full items-end justify-center gap-1">
            <div title={`Received: ${item.received}`} className="w-2 rounded-t-sm" style={{ height: `${(item.received / max) * 100}%`, background: C.green }} />
            <div title={`Verified: ${item.verified}`} className="w-2 rounded-t-sm" style={{ height: `${(item.verified / max) * 100}%`, background: C.terracotta }} />
            <div title={`Pending: ${item.pending}`} className="w-2 rounded-t-sm" style={{ height: `${(item.pending / max) * 100}%`, background: C.gold }} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: C.slate }}>{item.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const { data: stats } = useSWR<StatsOverview>("/api/stats/overview", getStatsOverview);
  const { data: applications } = useSWR<ApplicationRead[]>("/api/applications", getApplications);
  const { data: auditLogs } = useSWR<AuditLogListResponse>(
    "/api/audit-log?page=1&page_size=5",
    () => getAuditLogs({ page: 1, page_size: 5 })
  );

  const live = {
    ...FALLBACK_STATS,
    ...(stats ?? {}),
  };

  const total = live.total_applications || FALLBACK_STATS.total_applications;
  const deficient = live.deficient_count || FALLBACK_STATS.deficient_count;
  const recent = applications?.slice(0, 5) ?? [];

  return (
    <div className="min-h-full" style={{ color: C.navy }}>
      {/* Top government-style header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-3.5 shadow-[0_2px_10px_rgba(10,15,30,0.05)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm" style={{ background: C.green }}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: C.slate }}>Ministry of Tribal Affairs · Govt. of India</p>
            <h1 className="text-sm font-bold tracking-tight md:text-base">Scholarship & Fellowship Management System</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border px-3 py-2 md:flex" style={{ borderColor: "#DED6C8", background: "#FFFDF9" }}>
            <Search className="h-3.5 w-3.5" style={{ color: C.slate }} />
            <span className="text-[11px]" style={{ color: C.slate }}>Search application / beneficiary</span>
          </div>
          <button className="relative rounded-lg border p-2.5" style={{ borderColor: "#DED6C8", background: "#FFFDF9" }} aria-label="Notifications">
            <Bell className="h-4 w-4" style={{ color: C.navy }} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: C.terracotta }} />
          </button>
          <div className="hidden rounded-lg px-3 py-2 sm:block" style={{ background: "#EEE7DB" }}>
            <p className="text-[10px] font-semibold">{user?.full_name || "Administrator"}</p>
            <p className="text-[9px]" style={{ color: C.slate }}>{user?.role?.replaceAll("_", " ") || "SUPER ADMIN"}</p>
          </div>
        </div>
      </header>

      {/* Page title */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: C.terracotta }}>Administrative Command Centre</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-[28px]">Application Scrutiny & Conflict Check</h2>
          <p className="mt-1 max-w-2xl text-xs" style={{ color: C.slate }}>
            Unified visibility across NFST, NOS and future MoTA schemes — eligibility, document scrutiny, selection and post-selection workflows.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px]" style={{ color: C.slate }}>
          <span className="h-2 w-2 rounded-full" style={{ background: C.green }} />
          Live workflow data
        </div>
      </div>

      {/* Overview metrics */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Applications Received" value={live.total_applications.toLocaleString("en-IN")} note="Across active scholarship & fellowship schemes" icon={FileText} tone="green" />
        <MetricCard label="Deficiencies Flagged" value={live.deficient_count} note="Awaiting correction / re-upload" icon={AlertTriangle} tone="terracotta" />
        <MetricCard label="Pending Cross-Scheme Check" value={live.pending_disbursements_count} note="Cases requiring officer action" icon={Layers3} tone="gold" />
        <MetricCard label="Pending Process Rate" value={`${live.pending_renewals_count}`} note="Annual review / continuation cases" icon={Clock3} tone="navy" />
      </div>

      {/* Main review + right analytics */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)]">
        <section className="overflow-hidden rounded-xl border shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "#E7E0D3" }}>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: C.gold }} />
                <h3 className="text-sm font-bold">AI-Scrutiny Case Review</h3>
              </div>
              <p className="mt-1 text-[11px]" style={{ color: C.slate }}>Human-in-the-loop verification for high-risk or conflicting applications</p>
            </div>
            <Link href="/dashboard/scrutiny" className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: C.green }}>
              Open scrutiny queue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b p-5 lg:border-b-0 lg:border-r" style={{ borderColor: "#E7E0D3" }}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: C.slate }}>Selected Case</p>
                  <p className="mt-1 text-base font-bold">Birsa Munda</p>
                  <p className="text-[10px]" style={{ color: C.slate }}>NFST · Application NFST-2026-00421</p>
                </div>
                <StatusPill tone="warning">PENDING REVIEW</StatusPill>
              </div>

              <div className="flex min-h-[235px] items-center justify-center rounded-lg border p-4" style={{ background: "#EEE7DB", borderColor: "#DDD4C5" }}>
                <div className="w-full max-w-[260px] rounded-sm border bg-white p-4 shadow-sm" style={{ borderColor: "#D8D1C6" }}>
                  <div className="mb-4 h-2 w-20 rounded" style={{ background: C.green }} />
                  <div className="space-y-2">
                    {[82, 95, 70, 90, 58].map((width, i) => (
                      <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${width}%` }} />
                    ))}
                  </div>
                  <div className="mt-7 grid grid-cols-2 gap-2">
                    <div className="h-7 rounded border bg-slate-50" />
                    <div className="h-7 rounded border bg-slate-50" />
                  </div>
                  <p className="mt-4 text-center text-[8px] uppercase tracking-[0.12em] text-slate-400">Synthetic demonstration document</p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-lg border p-4" style={{ background: "#FFFDF9", borderColor: "#DDD4C5" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: C.slate }}>AI Verification Engine</p>
                    <p className="mt-1 text-sm font-bold">Conflict detected</p>
                  </div>
                  <div className="rounded-full p-2" style={{ background: "#E09E1820", color: C.gold }}>
                    <FileCheck2 className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 rounded-md px-3 py-2.5" style={{ background: "#E09E18", color: C.navy }}>
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <AlertTriangle className="h-3.5 w-3.5" /> AI Check: Pending Review
                  </div>
                </div>

                <div className="mt-3 rounded-md border p-3" style={{ borderColor: "#E7D4CC", background: "#FFF8F5" }}>
                  <div className="flex gap-2">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: C.terracotta }} />
                    <div>
                      <p className="text-[11px] font-bold" style={{ color: C.terracotta }}>Deficient Document · Caste Certificate</p>
                      <p className="mt-1 text-[10px] leading-5" style={{ color: C.slate }}>
                        OCR extracted a caste certificate value that conflicts with the application record. The engine flagged the mismatch for officer verification rather than auto-rejecting the applicant.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-[10px]">
                    <span style={{ color: C.slate }}>AI confidence</span>
                    <strong>80%</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E8E1D6]">
                    <div className="h-full rounded-full" style={{ width: "80%", background: C.gold }} />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button className="rounded-md px-3 py-2 text-[10px] font-bold text-white" style={{ background: C.green }}>Approve</button>
                  <button className="rounded-md px-3 py-2 text-[10px] font-bold text-white" style={{ background: C.terracotta }}>Decline</button>
                  <button className="rounded-md px-3 py-2 text-[10px] font-bold" style={{ background: "#E7E0D3", color: C.navy }}>Re-upload</button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  ["Identity", "Matched", "success"],
                  ["Eligibility", "Passed", "success"],
                  ["Document", "Conflict", "warning"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-md border p-2.5" style={{ borderColor: "#E7E0D3", background: "#FFFDF9" }}>
                    <p className="text-[9px]" style={{ color: C.slate }}>{label}</p>
                    <div className="mt-1"><StatusPill tone={tone === "success" ? "success" : "warning"}>{value}</StatusPill></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-xl border p-5 shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Application Rate</h3>
                <p className="mt-1 text-[10px]" style={{ color: C.slate }}>Received · verified · pending</p>
              </div>
              <span className="rounded-md px-2 py-1 text-[9px] font-semibold" style={{ background: "#EEE7DB", color: C.slate }}>This week</span>
            </div>
            <BarChart />
            <div className="mt-2 flex flex-wrap gap-3 text-[9px]" style={{ color: C.slate }}>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: C.green }} /> Received</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: C.terracotta }} /> Verified</span>
              <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: C.gold }} /> Pending</span>
            </div>
          </section>

          <section className="rounded-xl border p-5 shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Weekly Processing Rate</h3>
                <p className="mt-1 text-[10px]" style={{ color: C.slate }}>Workflow completion by day</p>
              </div>
              <CheckCircle2 className="h-4 w-4" style={{ color: C.green }} />
            </div>
            <div className="mt-4 space-y-3">
              {[
                ["Eligibility", 86, C.green],
                ["Scrutiny", 72, C.terracotta],
                ["Selection", 58, C.gold],
              ].map(([label, value, color]) => (
                <div key={label}>
                  <div className="mb-1 flex justify-between text-[10px]"><span>{label}</span><strong>{value}%</strong></div>
                  <div className="h-2 rounded-full bg-[#E8E1D6]"><div className="h-full rounded-full" style={{ width: `${value}%`, background: color as string }} /></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Workflow snapshot */}
      <section className="mt-5 rounded-xl border p-5 shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">End-to-End Workflow Snapshot</h3>
            <p className="mt-1 text-[10px]" style={{ color: C.slate }}>The dashboard mirrors PS26239: application → eligibility → scrutiny → selection → post-selection.</p>
          </div>
          <Link href="/dashboard/applications" className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: C.green }}>View applications <ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            ["Applications", total, Users],
            ["Eligibility", Math.max(0, total - deficient), ShieldCheck],
            ["Scrutiny", deficient, FileCheck2],
            ["Selection", Math.round(total * 0.16), CheckCircle2],
            ["Post-Selection", live.pending_renewals_count, RefreshCw],
          ].map(([label, value, Icon]) => (
            <div key={label as string} className="relative rounded-lg border p-3" style={{ background: "#FFFDF9", borderColor: "#E7E0D3" }}>
              <Icon className="h-4 w-4" style={{ color: C.slate }} />
              <p className="mt-3 text-[10px] font-medium" style={{ color: C.slate }}>{label as string}</p>
              <p className="mt-0.5 text-lg font-bold">{(value as number).toLocaleString("en-IN")}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom operational feeds */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-xl border shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
          <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#E7E0D3" }}>
            <div>
              <h3 className="text-sm font-bold">Recent Applications</h3>
              <p className="mt-1 text-[10px]" style={{ color: C.slate }}>Latest applications requiring monitoring</p>
            </div>
            <Link href="/dashboard/applications" className="text-[10px] font-semibold" style={{ color: C.green }}>View all</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#E7E0D3" }}>
            {(recent.length ? recent : FALLBACK_CASES).map((item: any, index) => {
              const name = item.applicant_name ?? item.name;
              const scheme = item.scheme_code ?? item.scheme;
              const state = item.current_state ?? item.status;
              const tone = state?.toLowerCase().includes("deficien") || state?.toLowerCase().includes("attention") ? "warning" : state?.toLowerCase().includes("approved") || state?.toLowerCase().includes("verified") ? "success" : "neutral";
              return (
                <div key={item.id ?? name ?? index} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold">{name}</p>
                    <p className="mt-0.5 truncate text-[9px]" style={{ color: C.slate }}>{scheme || "NFST"} · {item.applicant_email || "Application under workflow review"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone={tone as any}>{String(state || "SUBMITTED").replaceAll("_", " ")}</StatusPill>
                    <ArrowRight className="hidden h-3.5 w-3.5 sm:block" style={{ color: C.slate }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border shadow-[0_3px_14px_rgba(10,15,30,0.06)]" style={{ background: C.paper, borderColor: "#E7E0D3" }}>
          <div className="border-b px-5 py-4" style={{ borderColor: "#E7E0D3" }}>
            <h3 className="text-sm font-bold">Audit Activity</h3>
            <p className="mt-1 text-[10px]" style={{ color: C.slate }}>Immutable workflow events</p>
          </div>
          <div className="divide-y" style={{ borderColor: "#E7E0D3" }}>
            {(auditLogs?.items ?? []).slice(0, 5).map((log) => (
              <div key={log.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold uppercase" style={{ color: C.green }}>{log.action.replaceAll("_", " ")}</span>
                  <span className="text-[9px]" style={{ color: C.slate }}>{new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 truncate text-[10px]" style={{ color: C.slate }}>{log.from_state || "initial"} → {log.to_state || "recorded"}</p>
              </div>
            ))}
            {!auditLogs?.items?.length && (
              <div className="px-5 py-8 text-center text-[10px]" style={{ color: C.slate }}>Audit feed will populate from the live API.</div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-[9px]" style={{ borderColor: "#DDD4C5", color: C.slate }}>
        <span>SC/ST Scholarship & Fellowship Management System · SIH26239</span>
        <span>AI assists scrutiny; final administrative decisions remain human-controlled.</span>
      </div>
    </div>
  );
}
