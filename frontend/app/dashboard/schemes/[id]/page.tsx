"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { getScheme, type SchemeRead } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  Layers,
  ArrowLeft,
  Edit,
  CheckCircle2,
  AlertCircle,
  FileText,
  Workflow,
  ShieldCheck,
  Calendar,
  FileCode,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SchemeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();

  const { data: scheme, isLoading, error } = useSWR<SchemeRead>(
    id ? `/api/schemes/${id}` : null,
    () => getScheme(id)
  );

  const [copied, setCopied] = useState(false);

  const canEdit = user?.role === "SUPER_ADMIN" || user?.role === "SCHEME_ADMIN";

  const handleCopyJson = () => {
    if (!scheme?.config) return;
    navigator.clipboard.writeText(JSON.stringify(scheme.config, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/schemes">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Schemes
          </Button>
        </Link>
        <Card className="bg-red-950/20 border-red-900/60 p-6 text-center text-red-300">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-base font-semibold">Scheme not found</h2>
          <p className="text-xs text-red-400/80 mt-1">
            The requested scheme configuration could not be loaded.
          </p>
        </Card>
      </div>
    );
  }

  const config = scheme.config || {};
  const rules = config.eligibility_rules || [];
  const documents = config.required_documents || [];
  const states = config.workflow_states || [];
  const transitions = config.workflow_transitions || [];

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/schemes">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Schemes
          </Button>
        </Link>

        {canEdit && (
          <Link href={`/dashboard/schemes/${scheme.id}/edit`}>
            <Button
              id="edit-scheme-btn"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 shadow-md shadow-indigo-600/20"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit Scheme Config
            </Button>
          </Link>
        )}
      </div>

      {/* Scheme Header Banner */}
      <Card className="bg-slate-900/70 border-slate-800 text-slate-100 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                  {scheme.code}
                </span>
                <Badge
                  className={
                    scheme.is_active
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"
                      : "bg-slate-700/30 text-slate-400 border-slate-700 text-[10px]"
                  }
                >
                  {scheme.is_active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline" className="text-slate-400 border-slate-700 text-[10px]">
                  Version {config.version ?? 1}
                </Badge>
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight pt-1">
                {scheme.name}
              </h1>
            </div>

            <div className="text-right text-xs text-slate-400">
              <div>Created {new Date(scheme.created_at).toLocaleDateString()}</div>
              {config.initial_state && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Initial state: <span className="text-slate-300 font-mono">{config.initial_state}</span>
                </div>
              )}
            </div>
          </div>

          {scheme.description && (
            <CardDescription className="text-xs text-slate-300 mt-2 leading-relaxed">
              {scheme.description}
            </CardDescription>
          )}
        </CardHeader>
      </Card>

      {/* Config Sections Tabs */}
      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="bg-slate-900 border border-slate-800 p-1 text-xs">
          <TabsTrigger value="rules" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            Eligibility Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Required Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="workflow" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <Workflow className="w-3.5 h-3.5 mr-1.5" />
            Workflow Lifecycle ({states.length})
          </TabsTrigger>
          <TabsTrigger value="raw" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
            <FileCode className="w-3.5 h-3.5 mr-1.5" />
            Raw JSON
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Eligibility Rules */}
        <TabsContent value="rules" className="space-y-4">
          <Card className="bg-slate-900/60 border-slate-800 text-slate-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400 text-xs font-semibold">Field</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold">Condition Rule</TableHead>
                  <TableHead className="text-slate-400 text-xs font-semibold">Failure Message</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-800/80">
                {rules.length > 0 ? (
                  rules.map((rule, idx) => (
                    <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="font-mono text-xs font-semibold text-indigo-300">
                        {rule.field}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-300">
                        <div className="bg-slate-950/60 px-2 py-1 rounded border border-slate-800 inline-block">
                          {JSON.stringify(rule.condition)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-rose-300 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>{rule.failure_message}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-slate-500 py-8">
                      No eligibility rules configured for this scheme.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 2: Required Documents */}
        <TabsContent value="documents" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.length > 0 ? (
              documents.map((doc, idx) => (
                <Card key={idx} className="bg-slate-900/60 border-slate-800 text-slate-100 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">{doc.label}</div>
                      <div className="font-mono text-[11px] text-indigo-400 mt-0.5">{doc.doc_type}</div>
                    </div>
                    {doc.required ? (
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">
                        Mandatory
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 border-slate-700 text-[10px]">
                        Optional
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-400">
                    <span className="text-slate-500">Formats:</span>
                    {doc.accepted_formats?.map((fmt, fIdx) => (
                      <span
                        key={fIdx}
                        className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-slate-800 font-mono text-slate-300 uppercase text-[10px]"
                      >
                        {fmt}
                      </span>
                    ))}
                    {doc.validity_days && (
                      <span className="ml-auto text-slate-400 flex items-center gap-1 text-[10px]">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        Valid {doc.validity_days} days
                      </span>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="col-span-2 text-center text-xs text-slate-500 py-8 bg-slate-900/40 rounded-xl border border-slate-800">
                No required documents configured.
              </div>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Workflow */}
        <TabsContent value="workflow" className="space-y-6">
          {/* States list */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Workflow States ({states.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {states.map((st, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-medium text-slate-200">{st.label}</div>
                    <div className="font-mono text-[10px] text-slate-500">{st.name}</div>
                  </div>
                  {st.is_terminal ? (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-[9px]">
                      Terminal
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-500 border-slate-800 text-[9px]">
                      Active
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Transitions Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Allowed Transitions ({transitions.length})
            </h3>
            <Card className="bg-slate-900/60 border-slate-800 text-slate-100 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-950/40 border-b border-slate-800">
                  <TableRow className="border-slate-800">
                    <TableHead className="text-slate-400 text-xs font-semibold">From State</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold"></TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">To State</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Trigger Event</TableHead>
                    <TableHead className="text-slate-400 text-xs font-semibold">Authorized Roles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-800/80">
                  {transitions.map((tr, idx) => (
                    <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="font-mono text-xs text-slate-300">
                        {tr.from_state}
                      </TableCell>
                      <TableCell className="text-slate-500 text-center w-8">
                        <ArrowRight className="w-3.5 h-3.5 inline text-indigo-400" />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-indigo-300">
                        {tr.to_state}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px]">
                          {tr.trigger}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {tr.allowed_roles?.map((role, rIdx) => (
                            <Badge key={rIdx} variant="outline" className="text-[9px] text-slate-300 border-slate-700">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Raw JSON */}
        <TabsContent value="raw" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="text-xs border-slate-800 bg-slate-900 text-slate-300 hover:text-white h-7"
            >
              {copied ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied" : "Copy JSON"}
            </Button>
          </div>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-[500px]">
            {JSON.stringify(scheme.config, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
