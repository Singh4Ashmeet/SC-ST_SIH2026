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
import { useAuth } from "@/lib/auth-context";
import {
  UserCheck,
  Search,
  ArrowRight,
  ShieldAlert,
  Clock,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SelectionCommitteeQueuePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const isAuthorized =
    user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const { data: applications, isLoading } = useSWR<ApplicationRead[]>(
    isAuthorized ? "/api/applications" : null,
    () => getApplications()
  );

  const schemeMap = React.useMemo(() => {
    const map = new Map<string, SchemeRead>();
    schemes?.forEach((s) => map.set(s.id, s));
    return map;
  }, [schemes]);

  // Derive selection states per scheme by inspecting workflow transitions
  const selectionStatesByScheme = React.useMemo(() => {
    const map = new Map<string, Set<string>>();
    schemes?.forEach((s) => {
      const states = new Set<string>();
      const transitions = s.config?.workflow_transitions || [];
      transitions.forEach((t) => {
        // State reached after documents_verified
        if (t.trigger === "documents_verified") {
          states.add(t.to_state);
        }
        // State from which committee approves/rejects
        if (t.allowed_roles?.includes("SELECTION_COMMITTEE") && t.from_state) {
          states.add(t.from_state);
        }
      });
      if (states.size === 0) {
        states.add("selection");
      }
      map.set(s.id, states);
    });
    return map;
  }, [schemes]);

  // Filter for applications in selection review state
  const selectionApps = React.useMemo(() => {
    if (!applications) return [];
    return applications.filter((a) => {
      const allowedStates = selectionStatesByScheme.get(a.scheme_id);
      if (allowedStates) {
        return allowedStates.has(a.current_state);
      }
      return a.current_state === "selection";
    });
  }, [applications, selectionStatesByScheme]);

  const displayedApps = React.useMemo(() => {
    return selectionApps.filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.applicant_name.toLowerCase().includes(q) ||
        a.applicant_email.toLowerCase().includes(q) ||
        (schemeMap.get(a.scheme_id)?.code || "").toLowerCase().includes(q)
      );
    });
  }, [selectionApps, searchQuery, schemeMap]);

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The Selection Committee Queue is restricted to authorized committee members and super administrators.
            Your role (<span className="font-mono text-indigo-400">{user?.role}</span>) does not have committee evaluation privileges.
          </p>
          <div className="pt-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px] font-mono">
              Committee Portal
            </Badge>
            <span className="text-xs text-slate-400 font-medium">Final Award Determination</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2 mt-1">
            <UserCheck className="w-6 h-6 text-purple-400" />
            Selection Committee Queue
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Review candidates who have completed automated eligibility and officer document scrutiny.
            Approve scholarship awards or issue committee rejections.
          </p>
        </div>

        {/* Counter Card */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-xl">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Awaiting Review</div>
            <div className="text-xl font-bold text-white leading-none">
              {isLoading ? <Skeleton className="h-5 w-8 bg-slate-800" /> : selectionApps.length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="bg-slate-900/70 border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              placeholder="Search by candidate name, email, or scheme..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-950/60 border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 h-9"
            />
          </div>
        </div>
      </Card>

      {/* Applications Table */}
      <Card className="bg-slate-900/70 border-slate-800 overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-950/40 border-b border-slate-800">
            <TableRow className="hover:bg-transparent border-slate-800">
              <TableHead className="text-slate-400 text-xs">Applicant</TableHead>
              <TableHead className="text-slate-400 text-xs">Scheme</TableHead>
              <TableHead className="text-slate-400 text-xs">Stage</TableHead>
              <TableHead className="text-slate-400 text-xs">Submission Date</TableHead>
              <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} className="border-slate-800/60">
                  <TableCell><Skeleton className="h-4 w-36 bg-slate-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20 bg-slate-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24 bg-slate-800" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28 bg-slate-800" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto bg-slate-800" /></TableCell>
                </TableRow>
              ))
            ) : displayedApps.length === 0 ? (
              <TableRow className="border-slate-800/60">
                <TableCell colSpan={5} className="py-12 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                  No candidates currently pending Selection Committee determination.
                </TableCell>
              </TableRow>
            ) : (
              displayedApps.map((app) => {
                const scheme = schemeMap.get(app.scheme_id);
                return (
                  <TableRow key={app.id} className="border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                    <TableCell>
                      <div>
                        <div className="font-semibold text-slate-200 text-xs">{app.applicant_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{app.applicant_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-slate-950/60 border-slate-700 text-slate-300 font-mono text-[10px]">
                        {scheme?.code || "SCHEME"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">
                        Selection Review
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/selection/${app.id}`}>
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-7 px-3 shadow-sm shadow-purple-600/20"
                        >
                          Review Dossier
                          <ArrowRight className="w-3 h-3 ml-1.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
