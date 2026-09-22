"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getApplication, getScheme, getDocuments, getAvailableTransitions, applyTransition,
  type ApplicationRead, type SchemeRead, type DocumentRead, type WorkflowTransition,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft, UserCheck, CheckCircle2, XCircle, ShieldAlert, FileCheck2,
  User, AlertCircle, Layers, X,
} from "lucide-react";

function DocBadge({ status }: { status: string }) {
  const cls = status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === "DEFICIENT" ? "bg-rose-50 text-rose-700 border-rose-200" :
              "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>{status}</span>;
}

export default function SelectionReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params?.applicationId as string;
  const { user } = useAuth();
  const isAuthorized = user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: app, isLoading: appLoading } = useSWR<ApplicationRead>(
    isAuthorized && applicationId ? `/api/applications/${applicationId}` : null, () => getApplication(applicationId)
  );
  const { data: scheme } = useSWR<SchemeRead>(app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null, () => getScheme(app!.scheme_id));
  const { data: documents } = useSWR<DocumentRead[]>(applicationId ? `/api/applications/${applicationId}/documents` : null, () => getDocuments(applicationId));
  const { data: availableTransitions } = useSWR<WorkflowTransition[]>(applicationId ? `/api/applications/${applicationId}/available-transitions` : null, () => getAvailableTransitions(applicationId));

  const [actionModal, setActionModal] = useState<"APPROVE" | "REJECT" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { approveTrigger, rejectTrigger } = useMemo(() => {
    let approve = "committee_approved", reject = "committee_rejected";
    const transitions = availableTransitions || scheme?.config?.workflow_transitions || [];
    for (const t of transitions) {
      const trg = t.trigger.toLowerCase(), toSt = t.to_state.toLowerCase();
      if ((trg.includes("approv") || toSt.includes("approv") || toSt.includes("award")) && !toSt.includes("reject")) approve = t.trigger;
      if (trg.includes("reject") || toSt.includes("reject")) reject = t.trigger;
    }
    return { approveTrigger: approve, rejectTrigger: reject };
  }, [availableTransitions, scheme]);

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    setIsSubmitting(true); setActionError(null);
    try {
      const trigger = decision === "APPROVE" ? approveTrigger : rejectTrigger;
      await applyTransition(applicationId, trigger, { decision, remarks: remarks.trim() || undefined, decided_by: user?.id });
      await mutate(`/api/applications/${applicationId}`);
      await mutate(`/api/applications/${applicationId}/available-transitions`);
      await mutate("/api/applications");
      setActionModal(null);
      if (decision === "APPROVE") router.push(`/dashboard/applications/${applicationId}/post-selection`);
      else router.push("/dashboard/selection");
    } catch (err: any) { setActionError(err?.message || "Failed to record decision"); } finally { setIsSubmitting(false); }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-rose-800">Access Denied</h2>
          <p className="text-xs text-rose-500 mt-1">Restricted to Selection Committee members.</p>
          <Link href="/dashboard" className="inline-block mt-3 px-4 py-2 text-xs font-medium bg-white border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-50">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  if (appLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!app) return <div className="space-y-4"><Link href="/dashboard/selection" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Queue</Link><div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400">Application not found.</div></div>;

  const verifiedDocs = documents?.filter((d) => d.status === "VERIFIED") || [];
  const allVerified = documents && documents.length > 0 && documents.every((d) => d.status === "VERIFIED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/selection" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Queue</Link>
        <div className="flex items-center gap-2">
          <button onClick={() => { setActionModal("APPROVE"); setRemarks(""); setActionError(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition">
            <CheckCircle2 className="w-4 h-4" /> Approve
          </button>
          <button onClick={() => { setActionModal("REJECT"); setRemarks(""); setActionError(null); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition">
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 via-violet-50 to-indigo-50 rounded-xl p-6 border border-purple-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-gray-900">Selection Review</h2>
            </div>
            <h1 className="text-lg font-bold text-gray-800 mt-1">{app.applicant_name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{scheme?.name || "Scholarship"} • {app.applicant_email}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-3 border text-center ${allVerified ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
              <div className="text-[10px] text-gray-400">Document Status</div>
              <div className={`text-sm font-bold ${allVerified ? "text-emerald-700" : "text-amber-600"}`}>{allVerified ? "All Verified" : `${verifiedDocs.length}/${documents?.length || 0}`}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Applicant + Documents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-[#de5c36]" /> Applicant</h3>
          <div className="space-y-2 text-xs">
            <div><span className="text-gray-400">Name:</span> <span className="font-medium text-gray-800">{app.applicant_name}</span></div>
            <div><span className="text-gray-400">Email:</span> <span className="text-gray-600">{app.applicant_email}</span></div>
            {app.applicant_phone && <div><span className="text-gray-400">Phone:</span> <span className="text-gray-600">{app.applicant_phone}</span></div>}
            {app.applicant_data && Object.entries(app.applicant_data).map(([k, v]) => (
              <div key={k}><span className="text-gray-400 capitalize">{k.replace(/_/g, " ")}:</span> <span className="text-gray-700">{String(v)}</span></div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100"><h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5"><FileCheck2 className="w-3.5 h-3.5 text-[#de5c36]" /> Documents ({documents?.length ?? 0})</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {documents && documents.length > 0 ? documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-[#de5c36] font-medium">{doc.doc_type}</td>
                    <td className="px-4 py-2.5"><DocBadge status={doc.status} /></td>
                    <td className="px-4 py-2.5 text-[11px]">
                      {doc.deficiency_reasons?.length ? doc.deficiency_reasons.map((r, i) => (
                        <span key={i} className="text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{r.message}</span>
                      )) : doc.status === "VERIFIED" ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Passed</span> : <span className="text-gray-400">Pending</span>}
                    </td>
                  </tr>
                )) : <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No documents</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Available Transitions */}
      {availableTransitions && availableTransitions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-3"><Layers className="w-3.5 h-3.5 text-[#de5c36]" /> Available Workflow Transitions</h3>
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((t) => (
              <span key={t.trigger} className="px-3 py-1.5 text-[11px] font-medium bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {t.trigger} → <span className="text-[#de5c36] font-semibold">{t.to_state}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Decision Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">{actionModal === "APPROVE" ? "Approve Application" : "Reject Application"}</h3>
            <button onClick={() => setActionModal(null)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {actionModal === "APPROVE" ? "This will move the application to the approved/post-selection stage." : "This will reject and close this application."}
          </p>
          {actionError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{actionError}</div>}
          <div className="mb-4">
            <label className="text-[11px] text-gray-500 font-medium">Committee Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter review comments..."
              className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-24" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActionModal(null)} className="flex-1 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">Cancel</button>
            <button onClick={() => handleDecision(actionModal)} disabled={isSubmitting}
              className={`flex-1 py-2 text-xs font-semibold text-white rounded-lg transition disabled:opacity-50 ${
                actionModal === "APPROVE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
              }`}>{isSubmitting ? "Processing..." : actionModal === "APPROVE" ? "Confirm Approval" : "Confirm Rejection"}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
