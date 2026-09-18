"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { getAuditLogs, type AuditLogListResponse } from "@/lib/api";
import {
  History,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Clock,
  Filter,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function GlobalAuditLogPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useSWR<AuditLogListResponse>(
    `/api/audit-log?page=${page}&page_size=${pageSize}`,
    () => getAuditLogs({ page, page_size: pageSize })
  );

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  const getActionBadge = (action: string) => {
    if (action.includes("transition")) {
      return <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/40 text-[10px]">{action}</Badge>;
    }
    if (action.includes("created")) {
      return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">{action}</Badge>;
    }
    if (action.includes("scrutiny") || action.includes("deficient")) {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">{action}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-700">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">System Audit Trail</h1>
            <Badge variant="outline" className="text-xs bg-slate-900 border-slate-700 text-slate-300">
              {data?.total ?? 0} total records
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tamper-evident system activity log recording all user decisions, automated scrutiny executions, and workflow transitions
          </p>
        </div>

        {/* Pagination indicator */}
        <div className="flex items-center gap-2">
          <Button
            id="audit-prev-page-btn"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>

          <span className="text-xs text-slate-400 px-2 font-mono">
            Page {page} of {totalPages || 1}
          </span>

          <Button
            id="audit-next-page-btn"
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            className="h-8 text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Timestamp</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Action</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Transition (From → To)</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Resource</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Actor / Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-32 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-36 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48 bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : data?.items && data.items.length > 0 ? (
                data.items.map((log) => (
                  <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/40">
                    <TableCell className="text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>
                      {log.from_state || log.to_state ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400 font-mono text-[11px]">
                            {log.from_state || "initial"}
                          </span>
                          <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span className="text-indigo-300 font-semibold font-mono text-[11px]">
                            {log.to_state}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.application_id ? (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                          <FileSpreadsheet className="w-3 h-3 text-blue-400 shrink-0" />
                          <span>App: {log.application_id.slice(0, 8)}...</span>
                        </div>
                      ) : log.scheme_id ? (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-300">
                          <Layers className="w-3 h-3 text-indigo-400 shrink-0" />
                          <span>Scheme: {log.scheme_id.slice(0, 8)}...</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      <div className="space-y-0.5">
                        {log.actor_user_id && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            User: {log.actor_user_id.slice(0, 8)}...
                          </div>
                        )}
                        {log.details && (
                          <div className="font-mono text-[11px] text-slate-300 line-clamp-1 max-w-md">
                            {JSON.stringify(log.details)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs text-slate-500">
                    No audit records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
