"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  getStatsOverview,
  getApplications,
  getAuditLogs,
  type StatsOverview,
  type ApplicationRead,
  type AuditLogListResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  FileSpreadsheet,
  AlertTriangle,
  Banknote,
  IndianRupee,
  RefreshCw,
  History,
  ArrowUpRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const STATE_COLORS: Record<string, { bar: string; badge: string; label: string }> = {
  submitted: { bar: "bg-sky-500", badge: "bg-sky-500/20 text-sky-300 border-sky-500/40", label: "Submitted" },
  eligibility_check: { bar: "bg-blue-500", badge: "bg-blue-500/20 text-blue-300 border-blue-500/40", label: "Eligibility Check" },
  document_scrutiny: { bar: "bg-amber-500", badge: "bg-amber-500/20 text-amber-300 border-amber-500/40", label: "Document Scrutiny" },
  deficient: { bar: "bg-rose-500", badge: "bg-rose-500/20 text-rose-300 border-rose-500/40", label: "Deficient" },
  selection: { bar: "bg-purple-500", badge: "bg-purple-500/20 text-purple-300 border-purple-500/40", label: "Selection Committee" },
  approved: { bar: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", label: "Approved" },
  rejected: { bar: "bg-slate-500", badge: "bg-slate-500/20 text-slate-300 border-slate-500/40", label: "Rejected" },
};

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useSWR<StatsOverview>(
    "/api/stats/overview",
    () => getStatsOverview()
  );

  const { data: applications, isLoading: appsLoading } = useSWR<ApplicationRead[]>(
    "/api/applications",
    () => getApplications()
  );

  const { data: auditLogs, isLoading: auditLoading } = useSWR<AuditLogListResponse>(
    "/api/audit-log?page=1&page_size=6",
    () => getAuditLogs({ page: 1, page_size: 6 })
  );

  const getStateBadge = (state: string) => {
    const config = STATE_COLORS[state];
    if (config) {
      return <Badge className={`${config.badge} text-[10px]`}>{config.label}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">{state}</Badge>;
  };

  const totalApps = stats?.total_applications ?? 0;

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-900/40 p-6 md:p-8">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              National Scholarship Directorate
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {user?.full_name || "Administrator"}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Real-time pipeline monitoring, Selection Committee decisions, fund disbursement tracking, and renewal management across all SC/ST welfare schemes.
          </p>
        </div>
      </div>

      {/* 5 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Applications */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Total Applications</CardTitle>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">{stats?.total_applications ?? 0}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-indigo-400" />
              <span>Across all schemes</span>
            </p>
          </CardContent>
        </Card>

        {/* Deficient Applications */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Deficient Applications</CardTitle>
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-rose-400 tracking-tight">{stats?.deficient_count ?? 0}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-rose-400" />
              <span>Pending candidate resubmission</span>
            </p>
          </CardContent>
        </Card>

        {/* Pending Disbursements */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Pending Disbursements</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <Banknote className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-amber-400 tracking-tight">{stats?.pending_disbursements_count ?? 0}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Ready for banking release</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Disbursed */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Total Disbursed</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-24 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                {formatINR(stats?.total_disbursed_amount ?? 0)}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Released to candidates</span>
            </p>
          </CardContent>
        </Card>

        {/* Pending Renewals */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Pending Renewals</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <RefreshCw className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-purple-400 tracking-tight">{stats?.pending_renewals_count ?? 0}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Annual review cycles</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual Breakdowns: Applications by State & Applications by Scheme */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Workflow State */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
              <span>Applications by Workflow State</span>
              <span className="text-xs font-normal text-slate-400">{totalApps} total</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Distribution of applications across automated and human scrutiny stages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full bg-slate-800" />
                <Skeleton className="h-6 w-full bg-slate-800" />
                <Skeleton className="h-6 w-full bg-slate-800" />
              </div>
            ) : stats && Object.keys(stats.applications_by_state).length > 0 ? (
              Object.entries(stats.applications_by_state).map(([state, count]) => {
                const pct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
                const stateCfg = STATE_COLORS[state] || {
                  bar: "bg-slate-500",
                  badge: "bg-slate-500/20 text-slate-300",
                  label: state,
                };
                return (
                  <div key={state} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-300">{stateCfg.label}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 text-slate-400 border-slate-700">
                          {state}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{count}</span>
                        <span className="text-slate-500 text-[11px] w-9 text-right">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${stateCfg.bar} rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">No application state data available</div>
            )}
          </CardContent>
        </Card>

        {/* By Scheme */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-white flex items-center justify-between">
              <span>Applications by Welfare Scheme</span>
              <span className="text-xs font-normal text-slate-400">{totalApps} total</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Candidate volume categorized by national and state assistance schemes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-full bg-slate-800" />
                <Skeleton className="h-6 w-full bg-slate-800" />
                <Skeleton className="h-6 w-full bg-slate-800" />
              </div>
            ) : stats && Object.keys(stats.applications_by_scheme).length > 0 ? (
              Object.entries(stats.applications_by_scheme).map(([schemeCode, count]) => {
                const pct = totalApps > 0 ? Math.round((count / totalApps) * 100) : 0;
                return (
                  <div key={schemeCode} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200 tracking-wide">{schemeCode}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{count}</span>
                        <span className="text-slate-500 text-[11px] w-9 text-right">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-slate-800/80 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">No scheme distribution data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Sections Split: Recent Applications & Recent Audit Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Applications (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Recent Applications</h2>
              <p className="text-xs text-slate-400">Candidate submissions in the pipeline</p>
            </div>
            <Link href="/dashboard/applications">
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-300 hover:text-white">
                View All
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <Card className="bg-slate-900/60 border-slate-800 text-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-800">
              {appsLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full bg-slate-800" />
                  <Skeleton className="h-10 w-full bg-slate-800" />
                  <Skeleton className="h-10 w-full bg-slate-800" />
                </div>
              ) : applications && applications.length > 0 ? (
                applications.slice(0, 5).map((app) => (
                  <Link
                    key={app.id}
                    href={`/dashboard/applications/${app.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors group"
                  >
                    <div className="space-y-1 min-w-0 pr-4">
                      <div className="font-medium text-xs text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                        {app.applicant_name}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {app.applicant_email}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {getStateBadge(app.current_state)}
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No applications recorded yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Audit Log Activity Feed (1 Col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Recent Audit Activity</h2>
              <p className="text-xs text-slate-400">System actions & state shifts</p>
            </div>
            <Link href="/dashboard/audit">
              <Button variant="outline" size="sm" className="h-8 text-xs border-slate-700 bg-slate-900 text-slate-300 hover:text-white">
                Full Log
                <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <Card className="bg-slate-900/60 border-slate-800 text-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-800/80">
              {auditLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-8 w-full bg-slate-800" />
                  <Skeleton className="h-8 w-full bg-slate-800" />
                </div>
              ) : auditLogs?.items && auditLogs.items.length > 0 ? (
                auditLogs.items.map((log) => (
                  <div key={log.id} className="p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                        {log.action.replace("_", " ")}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {log.from_state || log.to_state ? (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="text-slate-500">{log.from_state || "initial"}</span>
                        <span>→</span>
                        <span className="text-indigo-400 font-medium">{log.to_state}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 truncate">
                        {log.details ? JSON.stringify(log.details) : "Action recorded"}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  No audit logs recorded yet.
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

