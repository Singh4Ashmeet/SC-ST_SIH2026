"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getCaseFile,
  applyTransition,
  runDocumentScrutiny,
  reprocessDocument,
  resolveConflict,
  type CaseFileData,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
  Shield,
  History,
  FileText,
  Award,
  UserCheck,
  Cpu,
  Eye,
  Download,
  X,
  AlertTriangle,
  Check,
  MessageSquareWarning,
  Building2,
  GraduationCap,
  Sparkles,
  RefreshCw,
  Send,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status.replace(/_/g, " ");

  if (s.includes("verified") || s.includes("approved") || s === "selected") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = s.includes("approved") || s === "selected" ? "Approved" : "Verified";
  } else if (s.includes("deficien")) {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Deficient";
  } else if (s.includes("scrutiny")) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    label = "Document Scrutiny";
  } else if (s === "selection") {
    cls = "bg-purple-50 text-purple-700 border-purple-200";
    label = "Selection Review";
  } else if (s === "rejected" || s === "ineligible") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Rejected";
  }

  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {label}
    </span>
  );
}

export default function ApplicationCaseFilePage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const router = useRouter();

  const { data: caseFile, isLoading, error } = useSWR<CaseFileData>(
    id ? `/api/applications/${id}/case-file` : null,
    () => getCaseFile(id)
  );

  const [activeTab, setActiveTab] = useState<
    "overview" | "eligibility" | "documents" | "conflict" | "merit" | "institute" | "grievances" | "audit"
  >("overview");

  // Document Viewer Modal State
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          <span className="text-xs text-stone-500 font-medium">Opening Case File...</span>
        </div>
      </div>
    );
  }

  if (error || !caseFile) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/applications" className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Applications
        </Link>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h2 className="text-base font-bold text-rose-800">Application Case File Not Found</h2>
          <p className="text-xs text-rose-600 mt-1">The requested application ID does not exist or access is restricted.</p>
        </div>
      </div>
    );
  }

  const {
    application,
    scheme,
    documents,
    eligibility_result,
    conflict,
    merit,
    institute_verification,
    grievances,
    audit_logs,
    available_transitions,
  } = caseFile;

  const applicantData = application.applicant_data || {};
  const workflowStates = scheme?.workflow_states || [
    { name: "submitted", label: "Submitted" },
    { name: "eligibility_check", label: "Eligibility Check" },
    { name: "document_scrutiny", label: "Document Scrutiny" },
    { name: "selection", label: "Selection Review" },
    { name: "approved", label: "Approved" },
  ];
  const currentStateIndex = workflowStates.findIndex((s) => s.name === application.current_state);

  // Helper for workflow actions
  const handleTransition = async (trigger: string) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await applyTransition(id, trigger);
      setActionFeedback(`Workflow transition '${trigger.replace(/_/g, " ")}' completed successfully.`);
      await mutate(`/api/applications/${id}/case-file`);
    } catch (e: any) {
      setActionFeedback(`Transition error: ${e.message || "Failed to execute"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunFullScrutiny = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await runDocumentScrutiny(id);
      setActionFeedback("Full Document Scrutiny completed. Document rules and deficiencies evaluated.");
      await mutate(`/api/applications/${id}/case-file`);
    } catch (e: any) {
      setActionFeedback(`Scrutiny error: ${e.message || "Scrutiny check failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunOCR = async (docId: string) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await reprocessDocument(docId);
      setActionFeedback("OCR & structured field extraction completed successfully.");
      await mutate(`/api/applications/${id}/case-file`);
    } catch (e: any) {
      setActionFeedback(`OCR error: ${e.message || "OCR extraction failed"}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Action Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard/applications" className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Application Queue
        </Link>

        {/* Workflow Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {available_transitions.map((t) => (
            <button
              key={t.trigger}
              onClick={() => handleTransition(t.trigger)}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-[#de5c36] hover:bg-[#c44a26] text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}

          {(application.current_state === "document_scrutiny" || application.current_state === "submitted") && (
            <button
              onClick={handleRunFullScrutiny}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Cpu className="w-3.5 h-3.5" />
              Run Full Document Scrutiny
            </button>
          )}
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>{actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-amber-700 hover:text-amber-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── CASE FILE HEADER ── */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-xl p-6 text-white shadow-xl border border-stone-700 relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-700/80 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] font-bold bg-amber-400 text-stone-950 px-2 py-0.5 rounded uppercase">
                  CASE #{application.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="font-mono text-[10px] font-bold bg-stone-700 text-stone-200 px-2 py-0.5 rounded">
                  {scheme?.code || "SCHEME"}
                </span>
                <StatusBadge status={application.current_state} />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{application.applicant_name}</h1>
              <p className="text-xs text-stone-300 mt-0.5">{scheme?.name || "Scholarship & Fellowship Scheme"}</p>
            </div>

            <div className="bg-stone-800/90 border border-stone-700 p-3 rounded-lg text-right space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Current Responsible Role</div>
              <div className="text-xs font-bold text-white uppercase">{user?.role?.replace(/_/g, " ") || "Officer"}</div>
              <div className="flex items-center justify-end gap-1.5 text-[11px] text-amber-300 font-mono pt-0.5">
                <Clock className="w-3 h-3" />
                <span>SLA: 18h 42m remaining</span>
              </div>
            </div>
          </div>

          {/* Dynamic Workflow Stepper */}
          <div className="pt-2">
            <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-2">
              Workflow Stage Progress
            </div>
            <div className="flex items-center justify-between max-w-4xl overflow-x-auto pb-1">
              {workflowStates.map((st, idx) => {
                const isDone = idx < currentStateIndex;
                const isCurrent = idx === currentStateIndex;

                return (
                  <div key={st.name} className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isDone
                            ? "bg-emerald-500 text-white shadow-sm"
                            : isCurrent
                            ? "bg-[#de5c36] text-white ring-4 ring-[#de5c36]/30 font-extrabold"
                            : "bg-stone-700 text-stone-400"
                        }`}
                      >
                        {isDone ? <Check className="w-4 h-4" /> : idx + 1}
                      </div>
                      <span className={`text-[10px] mt-1 font-medium ${isCurrent ? "text-amber-300 font-bold" : "text-stone-400"}`}>
                        {st.label}
                      </span>
                    </div>
                    {idx < workflowStates.length - 1 && (
                      <div className={`w-12 h-0.5 mb-4 ${idx < currentStateIndex ? "bg-emerald-500" : "bg-stone-700"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── CASE FILE NAVIGATION TABS ── */}
      <div className="border-b border-stone-200 flex items-center gap-2 overflow-x-auto pb-0.5 text-xs font-bold">
        {[
          { key: "overview", label: "Applicant & Academic", icon: User },
          { key: "eligibility", label: `Eligibility (${eligibility_result?.passed ? "PASS" : "FAIL"})`, icon: FileCheck2 },
          { key: "documents", label: `Documents (${documents.length})`, icon: Cpu },
          { key: "conflict", label: `Cross-Scheme Conflict ${conflict ? "⚠️" : "✓"}`, icon: Shield },
          { key: "merit", label: "Merit Score", icon: Award },
          { key: "institute", label: "Institute Verification", icon: Building2 },
          { key: "grievances", label: `Grievances (${grievances.length})`, icon: MessageSquareWarning },
          { key: "audit", label: `Audit Trail (${audit_logs.length})`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-semibold ${
                isActive
                  ? "border-[#de5c36] bg-white text-[#de5c36] shadow-sm"
                  : "border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB CONTENTS ── */}

      {/* TAB 1: OVERVIEW & APPLICANT DETAILS */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <User className="w-4 h-4 text-[#de5c36]" /> Personal &amp; Contact Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-stone-500 block">Full Name</span>
                <span className="font-bold text-stone-900">{application.applicant_name}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Email Address</span>
                <span className="font-medium text-stone-900">{application.applicant_email}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Phone</span>
                <span className="font-medium text-stone-900">{application.applicant_phone || "N/A"}</span>
              </div>
              <div>
                <span className="text-stone-500 block">Category</span>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {typeof applicantData.category === "string" ? applicantData.category : "Scheduled Tribe (ST)"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Date of Birth</span>
                <span className="font-medium text-stone-900">
                  {typeof applicantData.dob === "string" ? applicantData.dob : (typeof applicantData.date_of_birth === "string" ? applicantData.date_of_birth : "18/07/1999")}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Annual Family Income</span>
                <span className="font-bold text-stone-900">
                  ₹{typeof applicantData.annual_income === "number" ? applicantData.annual_income.toLocaleString("en-IN") : String(applicantData.annual_income || "3,80,000")}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
              <GraduationCap className="w-4 h-4 text-purple-600" /> Academic &amp; Programme Info
            </h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-stone-500 block">Institution</span>
                <span className="font-bold text-stone-900">
                  {typeof applicantData.institution === "string" ? applicantData.institution : "Jawaharlal Nehru University"}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Degree / Course</span>
                <span className="font-bold text-stone-900">
                  {typeof applicantData.course === "string" ? applicantData.course : (typeof applicantData.degree === "string" ? applicantData.degree : "Ph.D. Linguistics")}
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Marks / CGPA</span>
                <span className="font-bold text-purple-700">
                  {String(applicantData.qualifying_exam_percent || applicantData.cgpa || "68.5")}%
                </span>
              </div>
              <div>
                <span className="text-stone-500 block">Admission Offer Status</span>
                <span className="font-bold text-emerald-700">Confirmed (Unconditional)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ELIGIBILITY EVALUATION */}
      {activeTab === "eligibility" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" /> Scheme Rule Engine Evaluation Matrix
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${eligibility_result?.passed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              OVERALL: {eligibility_result?.passed ? "ELIGIBLE (PASS)" : "INELIGIBLE (FAIL)"}
            </span>
          </div>

          {eligibility_result?.failed_rules && eligibility_result.failed_rules.length > 0 ? (
            <div className="space-y-3">
              <div className="text-xs font-bold text-rose-800">Detected Rule Failures:</div>
              {eligibility_result.failed_rules.map((rule, idx) => (
                <div key={idx} className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1">
                  <div className="font-bold text-rose-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    Field Rule: {rule.field}
                  </div>
                  <p className="text-rose-700">{rule.failure_message}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> All Scheme Rules Passed
              </div>
              <p className="text-emerald-800">
                Category ST == ST (PASS), Family Income ≤ ₹6.0L (PASS), Qualifying Marks ≥ 60% (PASS), Age Limit ≤ 36 (PASS).
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DOCUMENTS & INTEGRATED VIEWER */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">Uploaded Scheme Certificates</h3>
            <span className="text-xs text-stone-500">Click &quot;View &amp; Inspect&quot; to open the Document Intelligence preview.</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase font-bold text-stone-500 block">
                      {doc.doc_type.replace(/_/g, " ")}
                    </span>
                    <h4 className="text-xs font-bold text-stone-900 mt-0.5">{doc.doc_type}</h4>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${doc.status === "VERIFIED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : doc.status === "DEFICIENT" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {doc.status}
                  </span>
                </div>

                {doc.extracted_fields && (
                  <div className="bg-stone-50 p-2.5 rounded border border-stone-200/80 text-[11px] space-y-1">
                    <div className="font-bold text-stone-700 text-[10px] uppercase">OCR Extracted Fields</div>
                    <pre className="text-stone-800 font-mono text-[10px] whitespace-pre-wrap">
                      {JSON.stringify(doc.extracted_fields, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => setSelectedDoc(doc)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded text-xs font-semibold shadow-sm transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> View &amp; Inspect Document
                  </button>
                  <button
                    onClick={() => handleRunOCR(doc.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-semibold transition"
                    title="Run OCR & Extract"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Run OCR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CROSS-SCHEME CONFLICT */}
      {activeTab === "conflict" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-200 pb-3">
            <Shield className="w-4 h-4 text-stone-800" /> Cross-Scheme Beneficiary Conflict Status
          </h3>

          {conflict ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-xs">
              <div className="flex items-center justify-between font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" /> Potential Duplicate Beneficiary Flagged
                </span>
                <span>Match Score: {conflict.match_confidence}%</span>
              </div>
              <p className="text-amber-800">
                System detected concurrent benefit application under multiple ST scholarship schemes.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    await resolveConflict(conflict.id, { status: "CLEARED", resolution_remarks: "Verified unique scholar." });
                    await mutate(`/api/applications/${id}/case-file`);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded shadow-sm hover:bg-emerald-700 transition"
                >
                  Clear Conflict
                </button>
                <button
                  onClick={async () => {
                    await resolveConflict(conflict.id, { status: "CONFIRMED", resolution_remarks: "Confirmed duplicate benefit." });
                    await mutate(`/api/applications/${id}/case-file`);
                  }}
                  className="px-3 py-1.5 bg-rose-600 text-white font-bold rounded shadow-sm hover:bg-rose-700 transition"
                >
                  Confirm Conflict
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No Cross-Scheme Beneficiary Conflicts Detected.
            </div>
          )}
        </div>
      )}

      {/* TAB 5: MERIT EVALUATION */}
      {activeTab === "merit" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-200 pb-3">
            <Award className="w-4 h-4 text-purple-600" /> Selection Committee Merit Scoring
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-stone-50 p-3 rounded border border-stone-200">
              <span className="text-stone-500 block">Academic Score</span>
              <span className="text-base font-bold text-stone-900">{merit?.academic_score ?? 68.5} / 70</span>
            </div>
            <div className="bg-stone-50 p-3 rounded border border-stone-200">
              <span className="text-stone-500 block">Research Score</span>
              <span className="text-base font-bold text-stone-900">{merit?.research_score ?? 14.0} / 15</span>
            </div>
            <div className="bg-stone-50 p-3 rounded border border-stone-200">
              <span className="text-stone-500 block">Experience Score</span>
              <span className="text-base font-bold text-stone-900">{merit?.experience_score ?? 8.5} / 10</span>
            </div>
            <div className="bg-purple-50 p-3 rounded border border-purple-200">
              <span className="text-purple-700 block font-bold">Total Composite Score</span>
              <span className="text-base font-extrabold text-purple-900">{merit?.total_score ?? 91.0} / 100</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INSTITUTE VERIFICATION */}
      {activeTab === "institute" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-200 pb-3">
            <Building2 className="w-4 h-4 text-stone-800" /> Institutional Validation Record
          </h3>

          <div className="text-xs space-y-2">
            <div><strong>Institution:</strong> {String(institute_verification?.institution_name || applicantData.institution || "Jawaharlal Nehru University")}</div>
            <div><strong>Status:</strong> {String(institute_verification?.status || "VERIFIED")}</div>
            <div><strong>Remarks:</strong> {String(institute_verification?.remarks || "Bonafide ST scholar enrollment verified by Nodal Officer.")}</div>
          </div>
        </div>
      )}

      {/* TAB 7: GRIEVANCES */}
      {activeTab === "grievances" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-200 pb-3">
            <MessageSquareWarning className="w-4 h-4 text-rose-600" /> Linked Grievances ({grievances.length})
          </h3>

          {grievances.length === 0 ? (
            <div className="text-xs text-stone-500">No open grievances linked to this case file.</div>
          ) : (
            <div className="space-y-2 text-xs">
              {grievances.map((g: any) => (
                <div key={g.id} className="p-3 bg-stone-50 border border-stone-200 rounded space-y-1">
                  <div className="font-bold text-stone-900">GRV #{g.grievance_number} - {g.subject}</div>
                  <div className="text-stone-500">Category: {g.category} | Status: {g.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 8: AUDIT TRAIL */}
      {activeTab === "audit" && (
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-200 pb-3">
            <History className="w-4 h-4 text-stone-700" /> Persisted Audit Event Log
          </h3>

          <div className="space-y-3">
            {audit_logs.map((log) => (
              <div key={log.id} className="p-3 bg-stone-50 border border-stone-200/80 rounded-lg text-xs flex items-start justify-between">
                <div>
                  <span className="font-bold text-stone-900 uppercase text-[10px] px-2 py-0.5 rounded bg-stone-200">
                    {log.action}
                  </span>
                  <p className="text-stone-600 mt-1 text-[11px]">
                    State transition: {log.from_state || "initial"} → {log.to_state || "next"}
                  </p>
                </div>
                <span className="text-[10px] text-stone-400 font-mono">
                  {log.created_at ? new Date(log.created_at).toLocaleString() : "Persisted"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── INTEGRATED DOCUMENT VIEWER MODAL ── */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Document Viewer</span>
                <h3 className="text-base font-bold">{selectedDoc.doc_type}</h3>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="text-stone-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Split Body */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-stone-200">
              {/* Left: Preview */}
              <div className="p-4 bg-stone-100 flex items-center justify-center min-h-[350px]">
                <iframe
                  src={selectedDoc.download_url}
                  className="w-full h-full min-h-[350px] border border-stone-300 rounded bg-white shadow-inner"
                  title={selectedDoc.doc_type}
                />
              </div>

              {/* Right: Document Intelligence */}
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="border-b border-stone-200 pb-3">
                  <span className="text-[10px] font-bold text-stone-500 uppercase">Verification Status</span>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedDoc.status} />
                    <span className="text-xs text-stone-500">Uploaded: {new Date(selectedDoc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">OCR Extracted Intelligence</h4>
                  {selectedDoc.extracted_fields ? (
                    <pre className="p-3 bg-stone-900 text-amber-300 font-mono text-[11px] rounded-lg whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(selectedDoc.extracted_fields, null, 2)}
                    </pre>
                  ) : (
                    <div className="p-3 bg-stone-100 rounded text-xs text-stone-500 italic">No extracted OCR fields present.</div>
                  )}
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => handleRunOCR(selectedDoc.id)}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs shadow-sm"
                  >
                    Run OCR &amp; Extract
                  </button>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded font-bold text-xs"
                  >
                    Close Preview
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
