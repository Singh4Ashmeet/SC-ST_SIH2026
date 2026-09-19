"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  getApplication,
  getScheme,
  getDocuments,
  getApplicationAuditLog,
  type ApplicationRead,
  type SchemeRead,
  type DocumentRead,
  type AuditLogEntry,
} from "@/lib/api";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Layers,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  ArrowRight,
  ShieldCheck,
  History,
  FileText,
  Award,
  UserCheck,
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

export default function ApplicationDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: app, isLoading: appLoading } = useSWR<ApplicationRead>(
    id ? `/api/applications/${id}` : null,
    () => getApplication(id)
  );

  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null,
    () => getScheme(app!.scheme_id)
  );

  const { data: documents, isLoading: docsLoading } = useSWR<DocumentRead[]>(
    id ? `/api/applications/${id}/documents` : null,
    () => getDocuments(id)
  );

  const { data: auditLogs, isLoading: auditLoading } = useSWR<AuditLogEntry[]>(
    id ? `/api/applications/${id}/audit-log` : null,
    () => getApplicationAuditLog(id)
  );

  if (appLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 lg:col-span-1 bg-slate-800" />
          <Skeleton className="h-64 lg:col-span-2 bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/applications">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Applications
          </Button>
        </Link>
        <Card className="bg-red-950/20 border-red-900/60 p-6 text-center text-red-300">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <h2 className="text-base font-semibold">Application Not Found</h2>
          <p className="text-xs text-red-400/80 mt-1">
            The requested application identifier does not exist or has been removed.
          </p>
        </Card>
      </div>
    );
  }

  // Workflow states progression
  const workflowStates = scheme?.config?.workflow_states || [
    { name: "submitted", label: "Submitted" },
    { name: "eligibility_check", label: "Eligibility Check" },
    { name: "document_scrutiny", label: "Document Scrutiny" },
    { name: "selection", label: "Selection Review" },
    { name: "approved", label: "Approved" },
  ];

  const currentStateIndex = workflowStates.findIndex(
    (s) => s.name === app.current_state
  );

  const getStateBadge = (state: string) => {
    switch (state) {
      case "submitted":
        return <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/40 text-xs">Submitted</Badge>;
      case "eligibility_check":
        return <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs">Eligibility Check</Badge>;
      case "document_scrutiny":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">Document Scrutiny</Badge>;
      case "deficient":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs">Deficient</Badge>;
      case "selection":
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">Selection Review</Badge>;
      case "approved":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{state}</Badge>;
    }
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Verified</Badge>;
      case "DEFICIENT":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Deficient</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Pending</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const needsScrutiny =
    app.current_state === "document_scrutiny" || app.current_state === "deficient";

  return (
    <div className="space-y-6">
      {/* Back button & Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/applications">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Applications
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {needsScrutiny && (
            <Link href={`/dashboard/scrutiny/${app.id}`}>
              <Button
                id="open-scrutiny-btn"
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 shadow-md shadow-amber-600/20"
              >
                <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
                Open Document Scrutiny View
              </Button>
            </Link>
          )}

          {app.current_state === "selection" && (
            <Link href={`/dashboard/selection/${app.id}`}>
              <Button
                id="open-selection-btn"
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 shadow-md shadow-purple-600/20"
              >
                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                Open Selection Review
              </Button>
            </Link>
          )}

          {(app.current_state === "approved" || app.current_state === "visa_issued") && (
            <Link href={`/dashboard/applications/${app.id}/post-selection`}>
              <Button
                id="open-post-selection-btn"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 shadow-md shadow-emerald-600/20 font-semibold"
              >
                <Award className="w-3.5 h-3.5 mr-1.5" />
                Post-Selection Management
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Header Banner */}
      <Card className="bg-slate-900/70 border-slate-800 text-slate-100 backdrop-blur-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                {scheme?.code || "SCHEME"}
              </span>
              {getStateBadge(app.current_state)}
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
              {app.applicant_name}
            </h1>
            <p className="text-xs text-slate-400">
              {scheme?.name || "Scholarship Program"}
            </p>
          </div>

          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <div>Application ID: <span className="font-mono text-slate-300">{app.id.slice(0, 8)}...</span></div>
            <div>Submitted: <span className="text-slate-300">{new Date(app.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Visual Workflow Stepper */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Workflow Progression Pipeline
          </div>

          <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
            {workflowStates.map((st, idx) => {
              const isPast = currentStateIndex > -1 && idx < currentStateIndex;
              const isCurrent = st.name === app.current_state;
              const isDeficient = app.current_state === "deficient" && st.name === "document_scrutiny";

              return (
                <div key={st.name} className="flex items-center flex-1 min-w-[130px] last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all border ${
                        isCurrent
                          ? "bg-indigo-600 text-white border-indigo-400 ring-4 ring-indigo-500/20"
                          : isDeficient
                          ? "bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/20"
                          : isPast
                          ? "bg-emerald-950 text-emerald-300 border-emerald-500/40"
                          : "bg-slate-900 text-slate-500 border-slate-800"
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : isDeficient ? (
                        <AlertCircle className="w-4 h-4 text-white" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-medium leading-tight ${
                        isCurrent || isDeficient ? "text-white font-semibold" : isPast ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {st.label}
                    </span>
                  </div>

                  {idx < workflowStates.length - 1 && (
                    <div
                      className={`h-0.5 w-full shrink-0 -mt-5 ${
                        isPast ? "bg-emerald-500/40" : "bg-slate-800"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Grid: Applicant Profile + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Applicant Profile (1 Col) */}
        <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-5 space-y-4">
          <CardHeader className="p-0 pb-3 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              Applicant Profile
            </CardTitle>
          </CardHeader>

          <div className="space-y-3 text-xs">
            <div>
              <div className="text-[11px] text-slate-500">Full Name</div>
              <div className="font-semibold text-slate-200 mt-0.5">{app.applicant_name}</div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Email Address</div>
              <div className="text-slate-300 mt-0.5">{app.applicant_email}</div>
            </div>
            {app.applicant_phone && (
              <div>
                <div className="text-[11px] text-slate-500">Contact Number</div>
                <div className="text-slate-300 mt-0.5">{app.applicant_phone}</div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-400">Submission Form Data:</div>
              {app.applicant_data && Object.keys(app.applicant_data).length > 0 ? (
                Object.entries(app.applicant_data).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-slate-800/40 text-[11px]">
                    <span className="text-slate-400 capitalize">{key.replace(/_/g, " ")}:</span>
                    <span className="font-medium text-slate-200 text-right">{String(val)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-[11px]">No extra form fields.</div>
              )}
            </div>
          </div>
        </Card>

        {/* Uploaded Documents (2 Cols) */}
        <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 text-slate-100 overflow-hidden">
          <CardHeader className="p-4 border-b border-slate-800 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Mandatory Documents ({documents?.length ?? 0})
            </CardTitle>
            {needsScrutiny && (
              <Link href={`/dashboard/scrutiny/${app.id}`}>
                <Button size="sm" variant="outline" className="h-7 text-xs border-amber-600/50 text-amber-300 hover:bg-amber-950/40">
                  Scrutiny Queue Detail
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </CardHeader>
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 text-xs font-semibold">Document Type</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Verification Status</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Upload Date</TableHead>
                <TableHead className="text-slate-400 text-xs font-semibold">Deficiency Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-800/80">
              {docsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i} className="border-slate-800">
                    <TableCell><Skeleton className="h-5 w-28 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 bg-slate-800" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32 bg-slate-800" /></TableCell>
                  </TableRow>
                ))
              ) : documents && documents.length > 0 ? (
                documents.map((doc) => (
                  <TableRow key={doc.id} className="border-slate-800">
                    <TableCell className="font-mono text-xs text-indigo-300 font-medium">
                      {doc.doc_type}
                    </TableCell>
                    <TableCell>{getDocStatusBadge(doc.status)}</TableCell>
                    <TableCell className="text-xs text-slate-400">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs">
                      {doc.deficiency_reasons && doc.deficiency_reasons.length > 0 ? (
                        <div className="space-y-1">
                          {doc.deficiency_reasons.map((r, rIdx) => (
                            <div key={rIdx} className="text-rose-300 text-[11px] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>{r.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : doc.status === "VERIFIED" ? (
                        <span className="text-emerald-400 text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Passed OCR verification
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Awaiting review</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-28 text-center text-xs text-slate-500">
                    No documents uploaded yet for this application.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Audit Trail for this application */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-5 space-y-4">
        <CardHeader className="p-0 pb-3 border-b border-slate-800">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-indigo-400" />
            Application Audit Trail ({auditLogs?.length ?? 0} Events)
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Immutable log of all status transitions, verification triggers, and administrative updates
          </CardDescription>
        </CardHeader>

        <div className="divide-y divide-slate-800/60">
          {auditLoading ? (
            <div className="py-4 space-y-2">
              <Skeleton className="h-6 w-full bg-slate-800" />
              <Skeleton className="h-6 w-full bg-slate-800" />
            </div>
          ) : auditLogs && auditLogs.length > 0 ? (
            auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                      {log.action.replace("_", " ")}
                    </span>
                    {log.from_state || log.to_state ? (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <span className="text-slate-500">{log.from_state || "initial"}</span>
                        <span>→</span>
                        <span className="text-indigo-400 font-medium">{log.to_state}</span>
                      </span>
                    ) : null}
                  </div>
                  {log.details && (
                    <div className="font-mono text-[11px] text-slate-400">
                      {JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
                <div className="text-right text-[11px] text-slate-500 shrink-0">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              No audit records logged for this application.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
