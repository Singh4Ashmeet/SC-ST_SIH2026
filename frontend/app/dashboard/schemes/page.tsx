"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  getSchemes,
  activateScheme,
  deactivateScheme,
  type SchemeRead,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Layers,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Power,
  Edit,
  Loader2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function SchemesPage() {
  const { user } = useAuth();
  const { data: schemes, isLoading, mutate } = useSWR<SchemeRead[]>(
    "/api/schemes",
    () => getSchemes()
  );

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const canManageSchemes =
    user?.role === "SUPER_ADMIN" || user?.role === "SCHEME_ADMIN";

  const handleToggleActive = async (e: React.MouseEvent, scheme: SchemeRead) => {
    e.preventDefault();
    e.stopPropagation();
    setTogglingId(scheme.id);

    try {
      if (scheme.is_active) {
        await deactivateScheme(scheme.id);
      } else {
        await activateScheme(scheme.id);
      }
      mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Scholarship Schemes</h1>
            <Badge variant="outline" className="text-xs bg-slate-900 border-slate-700 text-slate-300">
              {schemes?.length ?? 0} total
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configurable scheme definitions governing eligibility, document mandates, and state transition workflows
          </p>
        </div>

        {canManageSchemes && (
          <Link href="/dashboard/schemes/new">
            <Button
              id="create-scheme-btn"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 shadow-md shadow-indigo-600/20"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Scheme
            </Button>
          </Link>
        )}
      </div>

      {/* Schemes Table Card */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Code</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Scheme Name</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Version</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Status</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Rules / Docs</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Created At</TableHead>
                <TableHead className="text-right text-slate-400 text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-8 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24 bg-slate-800" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-7 w-20 ml-auto bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : schemes && schemes.length > 0 ? (
                schemes.map((scheme) => {
                  const rulesCount = scheme.config?.eligibility_rules?.length ?? 0;
                  const docsCount = scheme.config?.required_documents?.length ?? 0;

                  return (
                    <TableRow
                      key={scheme.id}
                      className="border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors group"
                      onClick={() => (window.location.href = `/dashboard/schemes/${scheme.id}`)}
                    >
                      <TableCell className="font-mono text-xs font-bold text-indigo-400">
                        {scheme.code}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-slate-200 group-hover:text-white transition-colors">
                          {scheme.name}
                        </div>
                        {scheme.description && (
                          <div className="text-[11px] text-slate-400 line-clamp-1 max-w-sm mt-0.5">
                            {scheme.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-300 font-mono">
                        v{scheme.config?.version ?? 1}
                      </TableCell>
                      <TableCell>
                        {scheme.is_active ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400 border-slate-700 text-[10px] gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        <span className="text-slate-300 font-medium">{rulesCount}</span> rules •{" "}
                        <span className="text-slate-300 font-medium">{docsCount}</span> docs
                      </TableCell>
                      <TableCell className="text-xs text-slate-400">
                        {new Date(scheme.created_at).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/schemes/${scheme.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-300 hover:text-white px-2">
                              View
                            </Button>
                          </Link>

                          {canManageSchemes && (
                            <>
                              <Link href={`/dashboard/schemes/${scheme.id}/edit`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-indigo-300 hover:text-indigo-200 px-2"
                                >
                                  <Edit className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </Button>
                              </Link>

                              <Button
                                variant="outline"
                                size="sm"
                                disabled={togglingId === scheme.id}
                                onClick={(e) => handleToggleActive(e, scheme)}
                                className={`h-7 text-xs px-2.5 ${
                                  scheme.is_active
                                    ? "border-rose-900/60 text-rose-300 hover:bg-rose-950/40 hover:text-rose-200"
                                    : "border-emerald-900/60 text-emerald-300 hover:bg-emerald-950/40 hover:text-emerald-200"
                                }`}
                              >
                                {togglingId === scheme.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Power className="w-3 h-3 mr-1" />
                                )}
                                {scheme.is_active ? "Deactivate" : "Activate"}
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-slate-500">
                    No scholarship schemes found.
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
