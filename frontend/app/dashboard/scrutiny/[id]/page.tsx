"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  getApplication,
  getScheme,
  getDocuments,
  getDeficiencySummary,
  runDocumentScrutiny,
  recordScrutinyDecision,
  verifyDocumentByOfficer,
  flagDocumentDeficientByOfficer,
  reprocessDocument,
  type ApplicationRead,
  type SchemeRead,
  type DocumentRead,
  type DeficiencySummary,
} from "@/lib/api";
import {
  ArrowLeft,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Loader2,
  FileText,
  ShieldCheck,
  Check,
  X,
  Clock,
  Send,
  Eye,
  RefreshCw,
  XCircle,
  HelpCircle,
  Sliders,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Download,
} from "lucide-react";

function DocBadge({ status }: { status: string }) {
  const cls =
    status === "VERIFIED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "DEFICIENT"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {status}
    </span>
  );
}

export default function ScrutinyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: app, isLoading: appLoading, mutate: mutateApp } = useSWR<ApplicationRead>(
    id ? `/api/applications/${id}` : null,
    () => getApplication(id)
  );
  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null,
    () => getScheme(app!.scheme_id)
  );
  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    id ? `/api/applications/${id}/documents` : null,
    () => getDocuments(id)
  );
  const { data: deficiencySummary, mutate: mutateDeficiency } = useSWR<DeficiencySummary>(
    id ? `/api/applications/${id}/deficiency-summary` : null,
    () => getDeficiencySummary(id)
  );

  // Action states
  const [isRunningScrutiny, setIsRunningScrutiny] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeModal, setActiveModal] = useState<"APPROVE" | "DEFICIENT" | "REJECT" | null>(null);
  const [officerRemarks, setOfficerRemarks] = useState("");
  const [isProcessingDecision, setIsProcessingDecision] = useState(false);

  // Document Inspection Drawer
  const [inspectedDoc, setInspectedDoc] = useState<DocumentRead | null>(null);
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [flagReasonInput, setFlagReasonInput] = useState("");
  const [showFlagModal, setShowFlagModal] = useState(false);

  // Compute SLA stats
  const slaInfo = useMemo(() => {
    if (!app) return { hoursRemaining: 36, status: "ON_TRACK", deadline: "48 hours SLA" };
    const createdAt = new Date(app.created_at).getTime();
    const now = Date.now();
    const elapsedHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
    const totalAllowed = 48;
    const remaining = Math.max(0, totalAllowed - elapsedHours);
    let status = "ON_TRACK";
    if (remaining <= 6) status = "CRITICAL";
    else if (remaining <= 18) status = "WARNING";
    return { hoursRemaining: remaining, status, elapsedHours };
  }, [app]);

  const refreshAll = async () => {
    await Promise.all([mutateApp(), mutateDocs(), mutateDeficiency()]);
  };

  const handleRunScrutiny = async () => {
    setIsRunningScrutiny(true);
    setActionFeedback(null);
    try {
      await runDocumentScrutiny(id);
      setActionFeedback({
        type: "success",
        text: "Dual Document Scrutiny (EfficientNet-B0 Visual Classifier + RapidOCR Engine) completed successfully.",
      });
      await refreshAll();
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to run scrutiny",
      });
    } finally {
      setIsRunningScrutiny(false);
    }
  };

  const handleOfficerDecision = async (decision: "APPROVE" | "DEFICIENT" | "REJECT") => {
    setIsProcessingDecision(true);
    setActionFeedback(null);
    try {
      const res = await recordScrutinyDecision(id, decision, officerRemarks.trim() || undefined);
      setActionFeedback({
        type: "success",
        text: res.message || `Case successfully processed with decision: ${decision}`,
      });
      setActiveModal(null);
      setOfficerRemarks("");
      await refreshAll();
      if (decision === "APPROVE") {
        setTimeout(() => router.push("/dashboard/scrutiny"), 1200);
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to record scrutiny decision",
      });
    } finally {
      setIsProcessingDecision(false);
    }
  };

  const handleVerifyDocument = async (docId: string) => {
    setDocActionLoading(true);
    try {
      await verifyDocumentByOfficer(docId, "Manually verified by Scrutiny Officer", id);
      setActionFeedback({
        type: "success",
        text: "Document marked as VERIFIED. Deficiency flags cleared.",
      });
      await refreshAll();
      if (inspectedDoc?.id === docId) {
        setInspectedDoc((prev) => (prev ? { ...prev, status: "VERIFIED", deficiency_reasons: [] } : null));
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to verify document",
      });
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleFlagDocument = async (docId: string) => {
    if (!flagReasonInput.trim()) return;
    setDocActionLoading(true);
    try {
      await flagDocumentDeficientByOfficer(docId, flagReasonInput.trim(), id);
      setActionFeedback({
        type: "success",
        text: `Document flagged as DEFICIENT: "${flagReasonInput}"`,
      });
      setShowFlagModal(false);
      setFlagReasonInput("");
      await refreshAll();
      if (inspectedDoc?.id === docId) {
        setInspectedDoc((prev) =>
          prev
            ? {
                ...prev,
                status: "DEFICIENT",
                deficiency_reasons: [{ code: "OFFICER_FLAGGED", message: flagReasonInput.trim() }],
              }
            : null
        );
      }
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to flag document",
      });
    } finally {
      setDocActionLoading(false);
    }
  };

  const handleReprocessDoc = async (docId: string) => {
    setDocActionLoading(true);
    try {
      await reprocessDocument(docId);
      setActionFeedback({
        type: "success",
        text: "Document reprocessed through Deep Learning Classifier & RapidOCR.",
      });
      await refreshAll();
    } catch (err: unknown) {
      setActionFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Reprocessing failed",
      });
    } finally {
      setDocActionLoading(false);
    }
  };

  if (appLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          <p className="text-xs text-stone-500 font-medium">Loading Officer Workbench...</p>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-8 text-center text-gray-400 space-y-3">
        <p>Application not found.</p>
        <Link href="/dashboard/scrutiny" className="text-xs text-[#de5c36] underline">
          Return to Scrutiny Queue
        </Link>
      </div>
    );
  }

  const missingDocs = deficiencySummary?.missing_documents || [];
  const verifiedDocs = documents?.filter((d) => d.status === "VERIFIED") || [];
  const deficientDocs = documents?.filter((d) => d.status === "DEFICIENT") || [];
  const pendingDocs = documents?.filter((d) => d.status === "PENDING") || [];
  const allVerified = documents && documents.length > 0 && verifiedDocs.length === documents.length && missingDocs.length === 0;

  return (
    <div className="space-y-6 pb-12">
      {/* ── TOP BREADCRUMB & UTILITY ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/dashboard/scrutiny"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Scrutiny Queue
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/applications/${app.id}`}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 shadow-sm"
          >
            Unified Case File
          </Link>
          <button
            id="run-scrutiny-btn"
            onClick={handleRunScrutiny}
            disabled={isRunningScrutiny}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-stone-900 hover:bg-stone-800 text-white rounded-lg shadow-sm transition disabled:opacity-50"
          >
            {isRunningScrutiny ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing AI Models...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-[#de5c36]" />
                Re-Run AI &amp; OCR Scrutiny
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── ACTION FEEDBACK NOTIFICATION ── */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border shadow-sm ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-gray-500 hover:text-gray-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── OFFICER COMMAND BANNER ── */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-xl p-6 text-white shadow-md border border-stone-700/60">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-300 px-2 py-0.5 rounded bg-stone-800 border border-amber-300/30">
                {scheme?.code || "SCHEME"}
              </span>
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  app.current_state === "deficient"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-400/30"
                    : "bg-amber-500/20 text-amber-300 border border-amber-400/30"
                }`}
              >
                Stage: {app.current_state.replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white pt-1">
              Scrutiny Officer Console: {app.applicant_name}
            </h1>
            <p className="text-xs text-stone-300">
              {app.applicant_email} • Application ID:{" "}
              <span className="font-mono text-amber-200 font-semibold">{app.id}</span>
            </p>
          </div>

          {/* SLA Tracker */}
          <div className="bg-stone-800/90 border border-stone-700 rounded-xl p-3.5 min-w-[200px] text-right space-y-1">
            <div className="flex items-center justify-end gap-1.5 text-xs text-stone-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Officer SLA Limit: <strong>48 Hours</strong></span>
            </div>
            <div className="text-lg font-bold text-white flex items-center justify-end gap-2">
              <span className={slaInfo.hoursRemaining <= 6 ? "text-rose-400" : "text-emerald-400"}>
                {slaInfo.hoursRemaining}h remaining
              </span>
            </div>
            <div className="text-[10px] text-stone-400">
              {slaInfo.elapsedHours} hours elapsed since stage submission
            </div>
          </div>
        </div>

        {/* ── INTERACTIVE OFFICER ACTION TOOLBAR ── */}
        <div className="mt-6 pt-5 border-t border-stone-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-stone-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Officer Role: Perform authoritative decision on documents and advance workflow.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* APPROVE ACTION */}
            <button
              id="officer-approve-btn"
              onClick={() => {
                setActiveModal("APPROVE");
                setOfficerRemarks("");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve Scrutiny
            </button>

            {/* DEFICIENCY ACTION */}
            <button
              id="officer-deficiency-btn"
              onClick={() => {
                setActiveModal("DEFICIENT");
                setOfficerRemarks(
                  deficientDocs.length > 0
                    ? `Please re-upload: ${deficientDocs.map((d) => d.doc_type).join(", ")}`
                    : ""
                );
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition active:scale-95"
            >
              <AlertTriangle className="w-4 h-4" />
              Issue Deficiency Notice
            </button>

            {/* REJECT ACTION */}
            <button
              id="officer-reject-btn"
              onClick={() => {
                setActiveModal("REJECT");
                setOfficerRemarks("");
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition active:scale-95"
            >
              <XCircle className="w-4 h-4" />
              Reject Case
            </button>
          </div>
        </div>
      </div>

      {/* ── SUMMARY STATS PILLS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Total Documents</div>
          <div className="text-xl font-bold text-stone-900 mt-1">{documents?.length ?? 0}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Verified</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{verifiedDocs.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Deficient</div>
          <div className="text-xl font-bold text-rose-700 mt-1">{deficientDocs.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-stone-200 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Pending Review</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{pendingDocs.length}</div>
        </div>
      </div>

      {/* ── MISSING DOCUMENTS WARNING ── */}
      {missingDocs.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Missing Mandatory Scheme Documents
          </div>
          <p className="text-xs text-rose-700">
            The applicant has not uploaded the following mandatory certificates required by{" "}
            <strong>{scheme?.name}</strong>:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {missingDocs.map((docType) => (
              <span
                key={docType}
                className="px-2.5 py-1 text-xs font-bold bg-white border border-rose-300 rounded-lg text-rose-700 shadow-sm"
              >
                {docType}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── DOCUMENT INTELLIGENCE TABLE WITH OFFICER ACTIONS ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50/50">
          <div>
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#de5c36]" /> Document Intelligence &amp; Officer Review
            </h3>
            <p className="text-xs text-stone-500">
              Evaluated via PyTorch EfficientNet-B0 Visual Classifier and RapidOCR Engine.
            </p>
          </div>
          <span className="text-[11px] font-medium text-stone-500">
            Click any row to open side-by-side field inspection
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-100/70 text-stone-600 font-semibold border-b border-stone-200">
              <tr>
                <th className="px-4 py-3">Document Type</th>
                <th className="px-4 py-3">Visual Model Verdict (document_classifier_final.pt)</th>
                <th className="px-4 py-3">OCR Status &amp; Fields</th>
                <th className="px-4 py-3">Current Status</th>
                <th className="px-4 py-3 text-right">Officer Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 text-stone-800">
              {docsLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                    Loading documents...
                  </td>
                </tr>
              ) : documents && documents.length > 0 ? (
                documents.map((doc) => {
                  const classification = doc.extracted_fields?.["_doc_classification"] as any;
                  const normClaimed = (doc.doc_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                  const normPred = (classification?.predicted_class || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                  const isVisualMatch = Boolean(
                    classification?.is_match_with_claimed_type === true ||
                    classification?.status === "CONFIRMED" ||
                    (normClaimed && normPred && (normClaimed === normPred || normClaimed.includes(normPred) || normPred.includes(normClaimed)))
                  );
                  const visualConf = classification?.confidence ? Math.round(classification.confidence * 100) : null;
                  const officerReview = doc.extracted_fields?.["_officer_review"] as any;

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-amber-50/40 transition cursor-pointer ${
                        inspectedDoc?.id === doc.id ? "bg-amber-50/60" : ""
                      }`}
                      onClick={() => setInspectedDoc(doc)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-[#de5c36]">{doc.doc_type}</div>
                        <div className="text-[10px] text-stone-400">
                          Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {classification ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block w-2 h-2 rounded-full ${
                                  isVisualMatch ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              <span className="font-semibold text-stone-900 text-[11px]">
                                {classification.predicted_class}
                              </span>
                              {visualConf !== null && (
                                <span className="text-[10px] font-mono text-stone-500">({visualConf}%)</span>
                              )}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isVisualMatch
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              {isVisualMatch ? "✓ Visual Claim Confirmed" : "⚠ Visual Mismatch"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px]">Awaiting classification</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {doc.deficiency_reasons && doc.deficiency_reasons.length > 0 ? (
                          <div className="space-y-0.5">
                            {doc.deficiency_reasons.map((r, i) => (
                              <div key={i} className="text-rose-600 flex items-center gap-1 text-[11px]">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {r.message}
                              </div>
                            ))}
                          </div>
                        ) : doc.status === "VERIFIED" ? (
                          <div className="text-emerald-700 flex items-center gap-1 text-[11px] font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Passed OCR Verification</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px]">Pending verification</span>
                        )}

                        {officerReview && (
                          <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                            Note: {officerReview.remarks}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <DocBadge status={doc.status} />
                      </td>

                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {doc.status !== "VERIFIED" && (
                            <button
                              onClick={() => handleVerifyDocument(doc.id)}
                              disabled={docActionLoading}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded shadow-sm transition"
                              title="Mark document as manually verified"
                            >
                              <Check className="w-3 h-3 inline mr-1" />
                              Verify
                            </button>
                          )}

                          {doc.status !== "DEFICIENT" && (
                            <button
                              onClick={() => {
                                setInspectedDoc(doc);
                                setShowFlagModal(true);
                              }}
                              disabled={docActionLoading}
                              className="px-2.5 py-1 text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded shadow-sm transition"
                              title="Flag document as deficient"
                            >
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              Flag
                            </button>
                          )}

                          <button
                            onClick={() => setInspectedDoc(doc)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-300 transition"
                          >
                            <Eye className="w-3 h-3 inline mr-1" />
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                    No documents attached to this application.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SIDE-BY-SIDE DOCUMENT INSPECTOR (DRAWER/MODAL) ── */}
      {inspectedDoc && (
        <div className="bg-white rounded-xl border-2 border-stone-900 shadow-md p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#de5c36]" />
              <div>
                <h3 className="text-sm font-extrabold text-stone-900 uppercase">
                  Inspecting: {inspectedDoc.doc_type}
                </h3>
                <span className="text-[11px] text-stone-500">Document ID: {inspectedDoc.id}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <DocBadge status={inspectedDoc.status} />
              <button
                onClick={() => setInspectedDoc(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            {/* Left: Real Document Preview (7 cols) */}
            <div className="lg:col-span-7 flex flex-col rounded-xl border border-stone-300 bg-stone-100 overflow-hidden min-h-[500px]">
              {(() => {
                const directFileUrl = `/api/applications/documents/${inspectedDoc.id}/file`;
                const isImage = Boolean(
                  (inspectedDoc.content_type && inspectedDoc.content_type.startsWith("image/")) ||
                  /\.(jpg|jpeg|png|webp)$/i.test(inspectedDoc.storage_key || "")
                );

                return (
                  <div className="flex flex-col h-full flex-1">
                    <div className="flex items-center justify-between px-3 py-2 bg-stone-200 border-b border-stone-300">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-[#de5c36]" />
                        <span className="font-bold text-stone-800 text-[11px] uppercase">
                          Original Uploaded Certificate
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-stone-700 uppercase border border-stone-200">
                          {isImage ? "IMAGE" : "PDF"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={directFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-stone-300 rounded text-stone-700 hover:text-stone-900 text-[11px] font-semibold shadow-sm"
                        >
                          <ExternalLink className="w-3 h-3 text-stone-500" /> Open in New Tab
                        </a>
                        <a
                          href={directFileUrl}
                          download={`${inspectedDoc.doc_type}_${inspectedDoc.id}.pdf`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#de5c36] text-white rounded hover:bg-[#c94d28] text-[11px] font-semibold shadow-sm"
                        >
                          <Download className="w-3 h-3" /> Download
                        </a>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col bg-white overflow-hidden min-h-[440px]">
                      {isImage ? (
                        <div className="flex-1 flex items-center justify-center p-3 bg-stone-50 overflow-auto">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={directFileUrl}
                            alt={inspectedDoc.doc_type}
                            className="max-h-[480px] max-w-full object-contain rounded shadow-sm border border-stone-200"
                          />
                        </div>
                      ) : (
                        <iframe
                          src={`${directFileUrl}#toolbar=1&navpanes=0`}
                          className="w-full flex-1 min-h-[440px] border-0"
                          title={inspectedDoc.doc_type}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Right: AI & OCR Findings + Manual Officer Decision (5 cols) */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                {/* Manual Review Callout if OCR is missing or deficient */}
                {(!inspectedDoc.extracted_fields ||
                  Object.keys(inspectedDoc.extracted_fields).filter((k) => !k.startsWith("_")).length === 0 ||
                  (inspectedDoc.deficiency_reasons && inspectedDoc.deficiency_reasons.length > 0)) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      OCR Incomplete or Deficiency Detected — Manual Review Mode
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-relaxed">
                      You can manually inspect the authentic document on the left and act on the decision to either confirm validity or flag missing requirements.
                    </p>
                  </div>
                )}

                {/* AI & Visual Classifier Findings */}
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                  <h4 className="font-bold text-stone-900 uppercase text-[11px] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#de5c36]" /> Visual Classifier &amp; Verification Signals
                  </h4>

                  {(() => {
                    const classification = inspectedDoc.extracted_fields?.["_doc_classification"] as any;
                    const normClaimed = (inspectedDoc.doc_type || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const normPred = (classification?.predicted_class || "").toLowerCase().replace(/[^a-z0-9]/g, "");
                    const isVisualMatch = Boolean(
                      classification?.is_match_with_claimed_type === true ||
                      classification?.status === "CONFIRMED" ||
                      (normClaimed && normPred && (normClaimed === normPred || normClaimed.includes(normPred) || normPred.includes(normClaimed)))
                    );

                    if (!classification) {
                      return <div className="p-3 text-center text-stone-400">Visual classification details pending.</div>;
                    }

                    return (
                      <div className="space-y-1.5">
                        <div className="p-2 rounded-lg bg-white border border-stone-200 flex items-center justify-between">
                          <span className="text-[10px] text-stone-500 font-semibold uppercase">Model Verdict</span>
                          <span className="font-bold text-stone-900 text-xs">
                            {classification.predicted_class}{" "}
                            {classification.confidence ? `(${Math.round(classification.confidence * 100)}%)` : ""}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-white border border-stone-200 flex items-center justify-between">
                          <span className="text-[10px] text-stone-500 font-semibold uppercase">Claim Consistency</span>
                          <span
                            className={`font-bold text-xs ${
                              isVisualMatch ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {isVisualMatch
                              ? "✓ Verified Match with Application Field"
                              : "⚠ Mismatch: Visual structure differs"}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* OCR Extracted Fields */}
                <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                  <h4 className="font-bold text-stone-900 uppercase text-[11px] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#de5c36]" /> RapidOCR Extracted Fields
                  </h4>

                  <div className="bg-white p-2.5 rounded-lg border border-stone-200 max-h-40 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {inspectedDoc.extracted_fields &&
                    Object.keys(inspectedDoc.extracted_fields).filter((k) => !k.startsWith("_")).length > 0 ? (
                      Object.entries(inspectedDoc.extracted_fields)
                        .filter(([k]) => !k.startsWith("_"))
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-stone-100 pb-1">
                            <span className="text-stone-500 font-sans">{k.replace(/_/g, " ")}:</span>
                            <span className="font-bold text-stone-900">{String(v)}</span>
                          </div>
                        ))
                    ) : (
                      <div className="text-stone-400 font-sans text-xs py-1">
                        No fields parsed automatically. Use manual officer verification below.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Officer Decision & Manual Override Actions */}
              <div className="pt-2 bg-stone-100 p-3 rounded-xl border border-stone-200 space-y-2">
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block">
                  Officer Manual Decision on Document
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleVerifyDocument(inspectedDoc.id)}
                    disabled={docActionLoading}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Verify Document (Manual Override)
                  </button>
                  <button
                    onClick={() => setShowFlagModal(true)}
                    disabled={docActionLoading}
                    className="flex-1 px-3 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" /> Flag Deficient
                  </button>
                  <button
                    onClick={() => handleReprocessDoc(inspectedDoc.id)}
                    disabled={docActionLoading}
                    className="px-3 py-2 text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg transition"
                    title="Re-run AI & OCR"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS FOR OFFICER DECISIONS ── */}

      {/* 1. APPROVAL MODAL */}
      {activeModal === "APPROVE" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirm Scrutiny Approval
              </h3>
              <button onClick={() => setActiveModal(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              You are certifying that all submitted documents for <strong>{app.applicant_name}</strong> have been
              verified for authenticity, caste eligibility, and income criteria. This will advance the case to the{" "}
              <strong>Selection Committee</strong>.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Official Scrutiny Remarks (Optional)
              </label>
              <textarea
                value={officerRemarks}
                onChange={(e) => setOfficerRemarks(e.target.value)}
                placeholder="e.g., Verified caste validity certificate and revenue income stamp. All parameters verified."
                className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#de5c36] focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOfficerDecision("APPROVE")}
                disabled={isProcessingDecision}
                className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isProcessingDecision ? "Processing..." : "Confirm & Advance to Selection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DEFICIENCY NOTICE MODAL */}
      {activeModal === "DEFICIENT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-base font-bold text-amber-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" /> Issue Deficiency Notice
              </h3>
              <button onClick={() => setActiveModal(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              This will transition the application to <strong>Document Correction Required (DEFICIENT)</strong> and
              send a formal notification to <strong>{app.applicant_email}</strong> requesting resubmission.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Specific Deficiency Instructions for Applicant *
              </label>
              <textarea
                value={officerRemarks}
                onChange={(e) => setOfficerRemarks(e.target.value)}
                placeholder="Specify which document has issues (e.g. Caste certificate is expired, income proof does not have tehsildar seal)..."
                className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#de5c36] focus:outline-none"
                rows={4}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOfficerDecision("DEFICIENT")}
                disabled={isProcessingDecision || !officerRemarks.trim()}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isProcessingDecision ? "Sending Notice..." : "Issue Deficiency Notice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. REJECTION MODAL */}
      {activeModal === "REJECT" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-4 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-base font-bold text-rose-700 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-rose-600" /> Formal Scrutiny Rejection
              </h3>
              <button onClick={() => setActiveModal(null)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Are you sure you want to permanently reject this application? This action will be recorded in the
              cryptographic audit trail.
            </p>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-1">
                Formal Rejection Cause *
              </label>
              <textarea
                value={officerRemarks}
                onChange={(e) => setOfficerRemarks(e.target.value)}
                placeholder="State the statutory reason for rejection (e.g. Ineligible category, fraudulent certificate detected)..."
                className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#de5c36] focus:outline-none"
                rows={3}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleOfficerDecision("REJECT")}
                disabled={isProcessingDecision || !officerRemarks.trim()}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isProcessingDecision ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. INDIVIDUAL DOC FLAG MODAL */}
      {showFlagModal && inspectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="text-sm font-bold text-stone-900">
                Flag Deficiency: {inspectedDoc.doc_type}
              </h3>
              <button onClick={() => setShowFlagModal(false)}>
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>
            <p className="text-xs text-stone-500">
              Provide reason for flagging this document as deficient.
            </p>
            <input
              type="text"
              value={flagReasonInput}
              onChange={(e) => setFlagReasonInput(e.target.value)}
              placeholder="e.g. Illegible stamp, expired validity date"
              className="w-full text-xs p-2.5 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#de5c36] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleFlagDocument(inspectedDoc.id)}
                disabled={docActionLoading || !flagReasonInput.trim()}
                className="px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
              >
                Flag Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
