"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  getApplication, getScheme, getDocuments, getDeficiencySummary, resubmitDocument, runEligibilityCheck,
  type ApplicationRead, type SchemeRead, type DocumentRead, type DeficiencySummary,
} from "@/lib/api";
import {
  ArrowLeft, Loader2, AlertCircle, CheckCircle2, XCircle, Upload, FileText, Clock, Shield, Info, X,
} from "lucide-react";

const STATE_MESSAGES: Record<string, { label: string; description: string; color: string }> = {
  submitted: { label: "Application Submitted", description: "Your application is queued for automated eligibility evaluation.", color: "text-blue-600" },
  eligibility_check: { label: "Eligibility Check in Progress", description: "Our system is verifying your eligibility against scheme criteria.", color: "text-blue-600" },
  document_scrutiny: { label: "Documents Under Review", description: "A scrutiny officer is reviewing your documents for authenticity.", color: "text-amber-600" },
  deficient: { label: "Action Required: Document Correction", description: "Some documents need correction. Re-upload corrected versions below.", color: "text-rose-600" },
  selection: { label: "Selection Committee Review", description: "Your application is being evaluated by the selection committee.", color: "text-purple-600" },
  approved: { label: "Application Approved", description: "Congratulations! Your application has been approved.", color: "text-emerald-600" },
  rejected: { label: "Application Rejected", description: "Your application did not meet the eligibility criteria.", color: "text-rose-600" },
  disbursed: { label: "Funds Disbursed", description: "The scholarship amount has been disbursed to your account.", color: "text-emerald-600" },
};

export default function ApplicationStatusPage() {
  const params = useParams();
  const applicationId = params?.applicationId as string;
  const router = useRouter();

  const [resubmitDoc, setResubmitDoc] = useState<DocumentRead | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const { data: application, isLoading: appLoading, mutate: mutateApp } = useSWR<ApplicationRead>(
    applicationId ? `/api/applications/${applicationId}` : null, () => getApplication(applicationId!)
  );
  const { data: scheme, isLoading: schemeLoading } = useSWR<SchemeRead>(
    application?.scheme_id ? `/api/schemes/${application.scheme_id}` : null, () => getScheme(application!.scheme_id)
  );
  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    applicationId ? `/api/applications/${applicationId}/documents` : null, () => getDocuments(applicationId!)
  );
  const { data: deficiencySummary } = useSWR<DeficiencySummary>(
    application?.current_state === "deficient" && applicationId ? `/api/applications/${applicationId}/deficiency-summary` : null,
    () => getDeficiencySummary(applicationId!)
  );

  const currentState = application?.current_state || "submitted";
  const stateInfo = STATE_MESSAGES[currentState] || { label: currentState.replace(/_/g, " "), description: "Your application is being processed.", color: "text-gray-600" };

  const workflowStates = scheme?.config?.workflow_states ?? [
    { name: "submitted", label: "Submitted" }, { name: "eligibility_check", label: "Eligibility Check" },
    { name: "document_scrutiny", label: "Document Scrutiny" }, { name: "selection", label: "Selection Review" },
    { name: "approved", label: "Approved" }, { name: "rejected", label: "Rejected" },
  ];
  const currentStateIndex = workflowStates.findIndex((s: any) => s.name === currentState);

  const handleResubmit = async () => {
    if (!resubmitDoc || !resubmitFile) return;
    setIsResubmitting(true); setResubmitError(null);
    try {
      await resubmitDocument(applicationId, resubmitDoc.id, resubmitFile);
      await mutateApp(); await mutateDocs();
      setResubmitDoc(null); setResubmitFile(null);
    } catch (err) { setResubmitError(err instanceof Error ? err.message : "Failed"); }
    finally { setIsResubmitting(false); }
  };

  const handleRunEligibility = async () => {
    try { await runEligibilityCheck(applicationId); await mutateApp(); await mutateDocs(); router.refresh(); }
    catch (err) { alert(err instanceof Error ? err.message : "Failed"); }
  };

  if (appLoading || schemeLoading || docsLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!application || !scheme) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Application Not Found</h2>
        <Link href="/apply" className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 inline-block mt-3">Back to Schemes</Link>
      </div>
    );
  }

  const deficientDocs = documents?.filter((d) => d.status === "DEFICIENT") || [];
  const missingDocs = deficiencySummary?.missing_documents || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes</Link>

      {/* Status Banner */}
      <div className={`rounded-xl p-6 border shadow-sm ${
        currentState === "deficient" ? "bg-rose-50 border-rose-200" :
        currentState === "approved" || currentState === "disbursed" ? "bg-emerald-50 border-emerald-200" :
        currentState === "rejected" ? "bg-rose-50 border-rose-200" :
        "bg-blue-50 border-blue-200"
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            currentState === "approved" || currentState === "disbursed" ? "bg-emerald-100 text-emerald-600" :
            currentState === "deficient" || currentState === "rejected" ? "bg-rose-100 text-rose-600" :
            "bg-blue-100 text-blue-600"
          }`}>
            {currentState === "approved" || currentState === "disbursed" ? <CheckCircle2 className="w-5 h-5" /> :
             currentState === "deficient" ? <AlertCircle className="w-5 h-5" /> :
             currentState === "rejected" ? <XCircle className="w-5 h-5" /> :
             <Clock className="w-5 h-5" />}
          </div>
          <div>
            <h2 className={`text-lg font-bold ${stateInfo.color}`}>{stateInfo.label}</h2>
            <p className="text-xs text-gray-600 mt-0.5">{stateInfo.description}</p>
            <div className="mt-2 text-[11px] text-gray-400">
              <span>Application: <span className="font-mono">{applicationId.slice(0, 14)}</span></span>
              <span className="ml-3">Scheme: <span className="font-semibold text-gray-600">{scheme.name}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Progress */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Application Progress</h3>
        <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
          {workflowStates.filter((s: any) => s.name !== "rejected").map((st: any, i: number) => {
            const isPast = currentStateIndex > -1 && i < currentStateIndex;
            const isCurrent = st.name === currentState;
            return (
              <React.Fragment key={st.name}>
                <div className="flex flex-col items-center text-center min-w-[80px]">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${
                    isCurrent ? "bg-[#de5c36] text-white border-[#de5c36] ring-4 ring-[#de5c36]/20" :
                    isPast ? "bg-emerald-600 text-white border-emerald-500" :
                    "bg-gray-100 text-gray-400 border-gray-200"
                  }`}>{isPast ? <CheckCircle2 className="w-4 h-4" /> : i + 1}</div>
                  <span className={`text-[10px] font-medium mt-1 ${isCurrent ? "text-gray-900 font-semibold" : isPast ? "text-gray-700" : "text-gray-400"}`}>{st.label}</span>
                </div>
                {i < workflowStates.filter((s: any) => s.name !== "rejected").length - 1 && <div className={`w-6 h-0.5 -mt-4 ${isPast ? "bg-emerald-400" : "bg-gray-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Deficiency Section */}
      {currentState === "deficient" && (deficientDocs.length > 0 || missingDocs.length > 0) && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-rose-800 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Documents Requiring Attention</h3>
          {missingDocs.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-medium text-rose-700 mb-1.5">Missing Documents:</div>
              <div className="flex flex-wrap gap-1.5">
                {missingDocs.map((dt) => <span key={dt} className="px-2 py-0.5 text-[10px] font-medium bg-white border border-rose-200 rounded text-rose-700">{dt}</span>)}
              </div>
            </div>
          )}
          {deficientDocs.map((doc) => (
            <div key={doc.id} className="bg-white rounded-lg p-3 border border-rose-200">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-mono font-medium text-rose-700">{doc.doc_type}</div>
                  {doc.deficiency_reasons?.map((r, i) => (
                    <div key={i} className="text-[11px] text-rose-500 mt-0.5">{r.message}</div>
                  ))}
                </div>
                <button onClick={() => { setResubmitDoc(doc); setResubmitFile(null); setResubmitError(null); }}
                  className="px-3 py-1.5 text-[11px] font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg transition flex items-center gap-1">
                  <Upload className="w-3 h-3" /> Resubmit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><FileText className="w-4 h-4 text-[#de5c36]" /> Uploaded Documents</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5">Document</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Uploaded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents && documents.length > 0 ? documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50/70">
                  <td className="px-4 py-2.5 font-mono text-[11px] text-gray-700">{doc.doc_type}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      doc.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      doc.status === "DEFICIENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>{doc.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                </tr>
              )) : <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No documents uploaded.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Applicant Details */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Application Details</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{application.applicant_name}</span></div>
          <div><span className="text-gray-400">Email:</span> <span className="text-gray-600">{application.applicant_email}</span></div>
          {application.applicant_phone && <div><span className="text-gray-400">Phone:</span> <span className="text-gray-600">{application.applicant_phone}</span></div>}
          <div><span className="text-gray-400">Submitted:</span> <span className="text-gray-600">{new Date(application.created_at).toLocaleDateString()}</span></div>
        </div>
      </div>

      {/* Resubmit Modal */}
      {resubmitDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Resubmit: {resubmitDoc.doc_type}</h3><button onClick={() => setResubmitDoc(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
          {resubmitDoc.deficiency_reasons?.map((r, i) => (
            <div key={i} className="mb-2 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{r.message}</div>
          ))}
          <p className="text-xs text-gray-500 mb-3">Upload a corrected document to replace the deficient one.</p>
          {resubmitError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{resubmitError}</div>}
          <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setResubmitFile(e.target.files?.[0] || null)} className="w-full text-xs mb-3" />
          <button onClick={handleResubmit} disabled={!resubmitFile || isResubmitting}
            className="w-full py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg transition disabled:opacity-50">
            {isResubmitting ? "Uploading..." : "Upload Replacement"}
          </button>
        </div></div>
      )}
    </div>
  );
}