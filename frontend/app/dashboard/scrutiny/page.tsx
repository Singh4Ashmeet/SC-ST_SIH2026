"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  getApplications,
  getSchemes,
  type ApplicationRead,
  type SchemeRead,
} from "@/lib/api";
import {
  FileCheck2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Layers,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ScrutinyQueuePage() {
  const [filterTab, setFilterTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const { data: applications, isLoading } = useSWR<ApplicationRead[]>(
    "/api/applications",
    () => getApplications()
  );

  const schemeCodeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    schemes?.forEach((s) => map.set(s.id, s.code));
    return map;
  }, [schemes]);

  // Filter for applications in scrutiny or deficient
  const queueApps = React.useMemo(() => {
    if (!applications) return [];
    return applications.filter(
      (a) => a.current_state === "document_scrutiny" || a.current_state === "deficient"
    );
  }, [applications]);

  const displayedApps = React.useMemo(() => {
    return queueApps.filter((a) => {
      if (filterTab === "scrutiny" && a.current_state !== "document_scrutiny") return false;
      if (filterTab === "deficient" && a.current_state !== "deficient") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.applicant_name.toLowerCase().includes(q) ||
          a.applicant_email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [queueApps, filterTab, searchQuery]);

  const scrutinyCount = queueApps.filter((a) => a.current_state === "document_scrutiny").length;
  const deficientCount = queueApps.filter((a) => a.current_state === "deficient").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Document Scrutiny Queue</h1>
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
            {queueApps.length} pending review
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Scrutiny officer workspace for executing OCR extraction, verifying certificates, and managing deficiency resubmissions
        </p>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={filterTab} onValueChange={setFilterTab}>
          <TabsList className="bg-slate-900 border border-slate-800 p-1 text-xs">
            <TabsTrigger value="ALL" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
              All Queue Items ({queueApps.length})
            </TabsTrigger>
            <TabsTrigger value="scrutiny" className="data-[state=active]:bg-amber-600 data-[state=active]:text-white">
              <Clock className="w-3.5 h-3.5 mr-1" />
              In Scrutiny ({scrutinyCount})
            </TabsTrigger>
            <TabsTrigger value="deficient" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Deficient ({deficientCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            id="scrutiny-search-input"
            placeholder="Search candidate name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-slate-900/80 border-slate-800 text-xs text-slate-200 h-9"
          />
        </div>
      </div>

      {/* Scrutiny Queue Table */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Applicant</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Scheme</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Scrutiny Stage</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Submission Date</TableHead>
                <TableHead className="text-right text-slate-400 text-xs font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-36 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : displayedApps.length > 0 ? (
                displayedApps.map((app) => (
                  <TableRow
                    key={app.id}
                    className="border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    onClick={() => (window.location.href = `/dashboard/scrutiny/${app.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-xs text-slate-200 group-hover:text-white transition-colors">
                        {app.applicant_name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {app.applicant_email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-900/40">
                        {schemeCodeMap.get(app.scheme_id) || "SCHEME"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {app.current_state === "deficient" ? (
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Deficient Notice
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Awaiting Scrutiny
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/dashboard/scrutiny/${app.id}`}>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                        >
                          Scrutinize
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs text-slate-500">
                    No applications currently require document scrutiny.
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
