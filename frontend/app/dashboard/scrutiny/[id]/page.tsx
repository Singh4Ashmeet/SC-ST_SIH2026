"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  getApplication, getScheme, getDocuments, getDeficiencySummary,
  runDocumentScrutiny, resubmitDocument,
  type ApplicationRead, type SchemeRead, type DocumentRead, type DeficiencySummary,
} from "@/lib/api";
import {
  ArrowLeft, FileCheck2, AlertTriangle, CheckCircle2, Play,
  Upload, Loader2, FileText, ShieldCheck, Check, X,
} from "lucide-react";

function DocBadge({ status }: { status: string }) {
  const cls = status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === "DEFICIENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
              "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>{status}</span>;
}

export default function ScrutinyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: app, isLoading: appLoading, mutate: mutateApp } = useSWR<ApplicationRead>(
    id ? `/api/applications/${id}` : null, () => getApplication(id)
  );
  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null, () => getScheme(app!.scheme_id)
  );
  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    id ? `/api/applications/${id}/documents` : null, () => getDocuments(id)
  );
  const { data: deficiencySummary, mutate: mutateDeficiency } = useSWR<DeficiencySummary>(
    id ? `/api/applications/${id}/deficiency-summary` : null, () => getDeficiencySummary(id)
  );

  const [isRunningScrutiny, setIsRunningScrutiny] = useState(false);
  const [scrutinyMsg, setScrutinyMsg] = useState<string | null>(null);
  const [resubmitDoc, setResubmitDoc] = useState<DocumentRead | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleRunScrutiny = async () => {
    setIsRunningScrutiny(true); setScrutinyMsg(null);
    try {
      await runDocumentScrutiny(id);
      setScrutinyMsg("Document scrutiny executed successfully.");
      mutateApp(); mutateDocs(); mutateDeficiency();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to run scrutiny");
    } finally { setIsRunningScrutiny(false); }
  };

  const handleResubmit = async () => {
    if (!resubmitDoc || !selectedFile) return;
    setIsUploading(true);
    try {
      await resubmitDocument(id, resubmitDoc.id, selectedFile);
      setResubmitDoc(null); setSelectedFile(null);
      mutateApp(); mutateDocs(); mutateDeficiency();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to upload");
    } finally { setIsUploading(false); }
  };

  if (appLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!app) return <div className="p-8 text-center text-gray-400">Application not found.</div>;

  const missingDocs = deficiencySummary?.missing_documents || [];
  const verifiedDocs = documents?.filter((d) => d.status === "VERIFIED") || [];
  const deficientDocs = documents?.filter((d) => d.status === "DEFICIENT") || [];
  const pendingDocs = documents?.filter((d) => d.status === "PENDING") || [];

  return (
    <div className="space-y-6">
      {/* Top Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link href="/dashboard/scrutiny" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scrutiny Queue
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/applications/${app.id}`} className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">View Application</Link>
          <button id="run-scrutiny-btn" onClick={handleRunScrutiny} disabled={isRunningScrutiny}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition disabled:opacity-50">
            {isRunningScrutiny ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing OCR...</> : <><Play className="w-3.5 h-3.5" /> Run Document Scrutiny</>}
          </button>
        </div>
      </div>

      {scrutinyMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {scrutinyMsg}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50 rounded-xl p-6 border border-amber-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#de5c36] px-2 py-0.5 rounded bg-white/60 border border-[#de5c36]/30">{scheme?.code || "SCHEME"}</span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                app.current_state === "deficient" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>{app.current_state === "deficient" ? "Deficient Notice" : "Document Scrutiny"}</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight pt-1">Scrutiny Workbench: {app.applicant_name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{app.applicant_email} • ID: {app.id.slice(0, 14)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-3 border border-emerald-200 text-center">
              <div className="text-[10px] text-gray-400">Verified</div>
              <div className="text-lg font-bold text-emerald-700">{verifiedDocs.length}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-rose-200 text-center">
              <div className="text-[10px] text-gray-400">Deficient</div>
              <div className="text-lg font-bold text-rose-600">{deficientDocs.length}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
              <div className="text-[10px] text-gray-400">Pending</div>
              <div className="text-lg font-bold text-amber-600">{pendingDocs.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Missing Documents Alert */}
      {missingDocs.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <h3 className="text-xs font-bold text-rose-800 flex items-center gap-1.5 mb-2"><AlertTriangle className="w-4 h-4" /> Missing Required Documents</h3>
          <div className="flex flex-wrap gap-2">
            {missingDocs.map((docType) => (
              <span key={docType} className="px-2.5 py-1 text-[11px] font-medium bg-white border border-rose-200 rounded-full text-rose-700">{docType}</span>
            ))}
          </div>
        </div>
      )}

      {/* Document Analysis Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-[#de5c36]" /> Document Analysis ({documents?.length ?? 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5">Document Type</th><th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">OCR Findings</th><th className="px-4 py-2.5">Uploaded</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docsLoading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : documents && documents.length > 0 ? (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#de5c36] font-medium">{doc.doc_type}</td>
                    <td className="px-4 py-2.5"><DocBadge status={doc.status} /></td>
                    <td className="px-4 py-2.5 text-[11px]">
                      {doc.deficiency_reasons && doc.deficiency_reasons.length > 0 ? (
                        <div className="space-y-0.5">
                          {doc.deficiency_reasons.map((r, i) => (
                            <div key={i} className="text-rose-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{r.message}</div>
                          ))}
                        </div>
                      ) : doc.status === "VERIFIED" ? (
                        <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passed OCR</span>
                      ) : <span className="text-gray-400">Awaiting analysis</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      {doc.status === "DEFICIENT" && (
                        <button onClick={() => { setResubmitDoc(doc); setSelectedFile(null); }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200">
                          <Upload className="w-3 h-3 inline mr-1" />Resubmit
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No documents found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deficiency Summary */}
      {deficiencySummary && (missingDocs.length > 0 || deficientDocs.length > 0) && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-[#de5c36]" /> Deficiency Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-gray-400">Deficient Docs</div><div className="text-lg font-bold text-rose-600">{deficientDocs.length}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-gray-400">Missing Docs</div><div className="text-lg font-bold text-amber-600">{missingDocs.length}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-gray-400">Documents Total</div><div className="text-lg font-bold text-gray-800">{documents?.length ?? 0}</div></div>
            <div className="bg-gray-50 rounded-lg p-3"><div className="text-gray-400">Status</div><div className="text-lg font-bold text-rose-600">{(missingDocs.length > 0 || deficientDocs.length > 0) ? "DEFICIENT" : "OK"}</div></div>
          </div>
        </div>
      )}

      {/* Resubmit Modal */}
      {resubmitDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Resubmit: {resubmitDoc.doc_type}</h3><button onClick={() => setResubmitDoc(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
          <p className="text-xs text-gray-500 mb-3">Upload a corrected replacement document for OCR re-analysis.</p>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="w-full text-xs mb-3" />
          <button onClick={handleResubmit} disabled={!selectedFile || isUploading}
            className="w-full py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg transition disabled:opacity-50">
            {isUploading ? "Uploading..." : "Upload Replacement"}
          </button>
        </div></div>
      )}
    </div>
  );
}
