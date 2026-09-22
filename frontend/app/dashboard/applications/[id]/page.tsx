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
  ArrowRight,
  ShieldCheck,
  History,
  FileText,
  Award,
  UserCheck,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status.replace(/_/g, " ");
  if (s.includes("verified") || s.includes("approved") || s === "selected") cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  else if (s.includes("deficien")) cls = "bg-rose-50 text-rose-700 border-rose-200";
  else if (s.includes("scrutiny")) cls = "bg-amber-50 text-amber-700 border-amber-200";
  else if (s === "rejected" || s === "ineligible") cls = "bg-rose-50 text-rose-700 border-rose-200";
  else if (s === "selection") cls = "bg-purple-50 text-purple-700 border-purple-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${cls}`}>{label}</span>;
}

function DocStatusBadge({ status }: { status: string }) {
  const cls =
    status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    status === "DEFICIENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
    "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>{status}</span>;
}

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
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/applications" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications
        </Link>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h2 className="text-base font-semibold text-rose-800">Application Not Found</h2>
          <p className="text-xs text-rose-500 mt-1">The requested application does not exist.</p>
        </div>
      </div>
    );
  }

  const workflowStates = scheme?.config?.workflow_states || [
    { name: "submitted", label: "Submitted" },
    { name: "eligibility_check", label: "Eligibility Check" },
    { name: "document_scrutiny", label: "Document Scrutiny" },
    { name: "selection", label: "Selection Review" },
    { name: "approved", label: "Approved" },
  ];
  const currentStateIndex = workflowStates.findIndex((s) => s.name === app.current_state);
  const needsScrutiny = app.current_state === "document_scrutiny" || app.current_state === "deficient";

  return (
    <div className="space-y-6">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/applications" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications
        </Link>
        <div className="flex items-center gap-2">
          {needsScrutiny && (
            <Link href={`/dashboard/scrutiny/${app.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition">
              <FileCheck2 className="w-3.5 h-3.5" /> Open Scrutiny View
            </Link>
          )}
          {app.current_state === "selection" && (
            <Link href={`/dashboard/selection/${app.id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-500 hover:bg-purple-600 text-white rounded-lg shadow-sm transition">
              <UserCheck className="w-3.5 h-3.5" /> Selection Review
            </Link>
          )}
          {(app.current_state === "approved" || app.current_state === "visa_issued") && (
            <Link href={`/dashboard/applications/${app.id}/post-selection`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition">
              <Award className="w-3.5 h-3.5" /> Post-Selection Management
            </Link>
          )}
        </div>
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#e7d8c6] via-[#dfccb7] to-[#d6bc9f] rounded-xl p-6 border border-[#cfbfa9] shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#de5c36] px-2 py-0.5 rounded bg-white/60 border border-[#de5c36]/30">
                {scheme?.code || "SCHEME"}
              </span>
              <StatusBadge status={app.current_state} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight pt-1">{app.applicant_name}</h1>
            <p className="text-xs text-stone-600">{scheme?.name || "Scholarship Program"}</p>
          </div>
          <div className="text-right text-xs text-stone-600 space-y-0.5">
            <div>Application ID: <span className="font-mono text-gray-800">{app.id.slice(0, 8)}...</span></div>
            <div>Submitted: <span className="text-gray-800">{new Date(app.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Workflow Stepper */}
        <div className="mt-6 pt-4 border-t border-stone-400/30">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-3 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#de5c36]" /> Workflow Progression
          </div>
          <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
            {workflowStates.map((st, idx) => {
              const isPast = currentStateIndex > -1 && idx < currentStateIndex;
              const isCurrent = st.name === app.current_state;
              const isDeficient = app.current_state === "deficient" && st.name === "document_scrutiny";
              return (
                <div key={st.name} className="flex items-center flex-1 min-w-[130px] last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 text-center flex-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                      isCurrent ? "bg-[#de5c36] text-white border-[#de5c36] ring-4 ring-[#de5c36]/20" :
                      isDeficient ? "bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/20" :
                      isPast ? "bg-emerald-600 text-white border-emerald-500" :
                      "bg-white text-gray-400 border-gray-300"
                    }`}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> :
                       isDeficient ? <AlertCircle className="w-4 h-4" /> :
                       idx + 1}
                    </div>
                    <span className={`text-[11px] font-medium leading-tight ${
                      isCurrent || isDeficient ? "text-gray-900 font-semibold" : isPast ? "text-stone-700" : "text-stone-400"
                    }`}>{st.label}</span>
                  </div>
                  {idx < workflowStates.length - 1 && (
                    <div className={`h-0.5 w-full shrink-0 -mt-5 ${isPast ? "bg-emerald-400" : "bg-stone-300"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Profile + Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Applicant Profile */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <div className="pb-3 border-b border-gray-100">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#de5c36]" /> Applicant Profile
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            <div><div className="text-[11px] text-gray-400">Full Name</div><div className="font-semibold text-gray-800 mt-0.5">{app.applicant_name}</div></div>
            <div><div className="text-[11px] text-gray-400">Email Address</div><div className="text-gray-600 mt-0.5">{app.applicant_email}</div></div>
            {app.applicant_phone && <div><div className="text-[11px] text-gray-400">Contact Number</div><div className="text-gray-600 mt-0.5">{app.applicant_phone}</div></div>}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="text-[11px] font-semibold text-gray-400">Submission Form Data:</div>
              {app.applicant_data && Object.keys(app.applicant_data).length > 0 ? (
                Object.entries(app.applicant_data).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-gray-50 text-[11px]">
                    <span className="text-gray-500 capitalize">{key.replace(/_/g, " ")}:</span>
                    <span className="font-medium text-gray-800 text-right">{String(val)}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-[11px]">No extra form fields.</div>
              )}
            </div>
          </div>
        </div>

        {/* Documents Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#de5c36]" /> Mandatory Documents ({documents?.length ?? 0})
            </h3>
            {needsScrutiny && (
              <Link href={`/dashboard/scrutiny/${app.id}`} className="text-[11px] font-semibold text-[#105a8b] hover:underline flex items-center gap-0.5">
                Scrutiny Detail <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2.5">Document Type</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Uploaded</th>
                  <th className="px-4 py-2.5">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docsLoading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading documents...</td></tr>
                ) : documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/70 transition">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[#de5c36] font-medium">{doc.doc_type}</td>
                      <td className="px-4 py-2.5"><DocStatusBadge status={doc.status} /></td>
                      <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-[11px]">
                        {doc.deficiency_reasons && doc.deficiency_reasons.length > 0 ? (
                          <div className="space-y-0.5">
                            {doc.deficiency_reasons.map((r, rIdx) => (
                              <div key={rIdx} className="text-rose-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" /><span>{r.message}</span>
                              </div>
                            ))}
                          </div>
                        ) : doc.status === "VERIFIED" ? (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Passed OCR verification
                          </span>
                        ) : (
                          <span className="text-gray-400">Awaiting review</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No documents uploaded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <div className="pb-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-[#de5c36]" /> Application Audit Trail ({auditLogs?.length ?? 0} Events)
          </h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Immutable log of all status transitions and administrative actions</p>
        </div>
        <div className="divide-y divide-gray-50 mt-2">
          {auditLoading ? (
            <div className="py-6 text-center text-gray-400 text-xs">Loading audit trail...</div>
          ) : auditLogs && auditLogs.length > 0 ? (
            auditLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800 uppercase tracking-wider text-[11px]">{log.action.replace("_", " ")}</span>
                    {(log.from_state || log.to_state) && (
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <span className="text-gray-500">{log.from_state || "initial"}</span>
                        <span>→</span>
                        <span className="text-[#de5c36] font-medium">{log.to_state}</span>
                      </span>
                    )}
                  </div>
                  {log.details && <div className="font-mono text-[11px] text-gray-400">{JSON.stringify(log.details)}</div>}
                </div>
                <div className="text-right text-[11px] text-gray-400 shrink-0">{new Date(log.created_at).toLocaleString()}</div>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-gray-400">No audit records logged.</div>
          )}
        </div>
      </div>
    </div>
  );
}
