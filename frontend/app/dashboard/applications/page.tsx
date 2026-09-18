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
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpRight,
  User,
  Layers,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const WORKFLOW_STATES = [
  { value: "ALL", label: "All Workflow States" },
  { value: "submitted", label: "Submitted" },
  { value: "eligibility_check", label: "Eligibility Check" },
  { value: "document_scrutiny", label: "Document Scrutiny" },
  { value: "deficient", label: "Deficient" },
  { value: "selection", label: "Selection Committee" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPage() {
  const [selectedScheme, setSelectedScheme] = useState<string>("ALL");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());

  const queryParams = {
    ...(selectedScheme !== "ALL" ? { scheme_id: selectedScheme } : {}),
    ...(selectedState !== "ALL" ? { current_state: selectedState } : {}),
  };

  const swrKey = `/api/applications?${new URLSearchParams(queryParams as Record<string, string>).toString()}`;

  const { data: applications, isLoading } = useSWR<ApplicationRead[]>(
    swrKey,
    () => getApplications(queryParams)
  );

  // Map scheme ID to scheme code
  const schemeCodeMap = React.useMemo(() => {
    const map = new Map<string, string>();
    schemes?.forEach((s) => map.set(s.id, s.code));
    return map;
  }, [schemes]);

  // Client-side text filter by applicant name or email
  const filteredApps = React.useMemo(() => {
    if (!applications) return [];
    if (!searchQuery.trim()) return applications;
    const q = searchQuery.toLowerCase();
    return applications.filter(
      (app) =>
        app.applicant_name.toLowerCase().includes(q) ||
        app.applicant_email.toLowerCase().includes(q)
    );
  }, [applications, searchQuery]);

  const getStateBadge = (state: string) => {
    switch (state) {
      case "submitted":
        return <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-[10px]">Submitted</Badge>;
      case "eligibility_check":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px]">Eligibility Check</Badge>;
      case "document_scrutiny":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Document Scrutiny</Badge>;
      case "deficient":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Deficient</Badge>;
      case "selection":
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">Selection Review</Badge>;
      case "approved":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{state}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Scholarship Applications</h1>
          <Badge variant="outline" className="text-xs bg-slate-900 border-slate-700 text-slate-300">
            {filteredApps.length} results
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Review candidate records, inspect automated verification logs, and track workflow progressions
        </p>
      </div>

      {/* Filter Controls Bar */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-4 backdrop-blur-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Query */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              id="applicant-search-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-slate-950/70 border-slate-800 text-xs text-slate-200 h-9"
            />
          </div>

          {/* Scheme Filter Dropdown */}
          <div>
            <Select value={selectedScheme} onValueChange={(val) => setSelectedScheme(val || "ALL")}>
              <SelectTrigger id="scheme-filter-select" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200 h-9 w-full">
                <SelectValue placeholder="All Schemes" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                <SelectItem value="ALL">All Schemes</SelectItem>
                {schemes?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Workflow State Filter Dropdown */}
          <div>
            <Select value={selectedState} onValueChange={(val) => setSelectedState(val || "ALL")}>
              <SelectTrigger id="state-filter-select" className="bg-slate-950/70 border-slate-800 text-xs text-slate-200 h-9 w-full">
                <SelectValue placeholder="All Workflow States" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 text-xs">
                {WORKFLOW_STATES.map((st) => (
                  <SelectItem key={st.value} value={st.value}>
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Applications Data Table */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Applicant</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Scheme</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Current State</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Application Date</TableHead>
                <TableHead className="text-right text-slate-400 text-xs font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-36 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-16 ml-auto bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : filteredApps.length > 0 ? (
                filteredApps.map((app) => (
                  <TableRow
                    key={app.id}
                    className="border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    onClick={() => (window.location.href = `/dashboard/applications/${app.id}`)}
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
                    <TableCell>{getStateBadge(app.current_state)}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {new Date(app.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/dashboard/applications/${app.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-300 hover:text-white group-hover:bg-slate-800"
                        >
                          View
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1 text-slate-500 group-hover:text-slate-200" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs text-slate-500">
                    No applications matching the selected criteria.
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
