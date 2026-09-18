"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  getSchemes,
  getApplications,
  getAuditLogs,
  type SchemeRead,
  type ApplicationRead,
  type AuditLogListResponse,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Layers,
  FileSpreadsheet,
  FileCheck2,
  History,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const { data: schemes, isLoading: schemesLoading } = useSWR<SchemeRead[]>(
    "/api/schemes",
    () => getSchemes()
  );

  const { data: applications, isLoading: appsLoading } = useSWR<ApplicationRead[]>(
    "/api/applications",
    () => getApplications()
  );

  const { data: auditLogs, isLoading: auditLoading } = useSWR<AuditLogListResponse>(
    "/api/audit-log?page=1&page_size=6",
    () => getAuditLogs({ page: 1, page_size: 6 })
  );

  // Derived metrics
  const activeSchemesCount = schemes?.filter((s) => s.is_active).length ?? 0;
  const totalSchemesCount = schemes?.length ?? 0;

  const totalAppsCount = applications?.length ?? 0;
  const scrutinyQueueCount =
    applications?.filter(
      (a) => a.current_state === "document_scrutiny" || a.current_state === "deficient"
    ).length ?? 0;

  const getStateBadge = (state: string) => {
    switch (state) {
      case "submitted":
        return <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]">Submitted</Badge>;
      case "eligibility_check":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">Eligibility</Badge>;
      case "document_scrutiny":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Scrutiny</Badge>;
      case "deficient":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Deficient</Badge>;
      case "selection":
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">Selection</Badge>;
      case "approved":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-900/40 p-6 md:p-8">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Administrative Control Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Welcome back, {user?.full_name || "Administrator"}
          </h1>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Monitor state transition workflows, inspect OCR document verifications, manage national scholarship rules, and audit all officer interventions in real time.
          </p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Schemes Card */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Total Schemes</CardTitle>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {schemesLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">{totalSchemesCount}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <span className="text-emerald-400 font-medium">{activeSchemesCount} active</span>
              <span>•</span>
              <span>{totalSchemesCount - activeSchemesCount} inactive</span>
            </p>
          </CardContent>
        </Card>

        {/* Applications Card */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Total Applications</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">{totalAppsCount}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-blue-400" />
              <span>Across all schemes</span>
            </p>
          </CardContent>
        </Card>

        {/* Scrutiny Queue Card */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Scrutiny Queue</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {appsLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-amber-400 tracking-tight">{scrutinyQueueCount}</div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Requires officer review</span>
            </p>
          </CardContent>
        </Card>

        {/* System Activity Card */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-400">Audit Trail Events</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
              <History className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <Skeleton className="h-7 w-16 bg-slate-800" />
            ) : (
              <div className="text-2xl font-bold text-white tracking-tight">
                {auditLogs?.total ?? 0}
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-purple-400" />
              <span>Tamper-evident logs</span>
            </p>
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
