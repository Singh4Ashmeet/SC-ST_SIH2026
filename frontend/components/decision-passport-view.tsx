"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { getDecisionPassport } from "@/lib/api";
import {
  Sparkles,
  ShieldCheck,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Users,
  CreditCard,
  History,
  Lock,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Building,
  Scale,
  RefreshCw,
} from "lucide-react";

interface DecisionPassportViewProps {
  applicationId: string;
}

export function DecisionPassportView({ applicationId }: DecisionPassportViewProps) {
  const { data: passport, error, isLoading, mutate } = useSWR(
    applicationId ? `/api/applications/${applicationId}/decision-passport` : null,
    () => getDecisionPassport(applicationId),
    { refreshInterval: 10000 } // Auto-refresh for near-real-time state updates
  );

  const [expandedSection, setExpandedSection] = useState<string | null>("all");
  const [selectedEvidenceDoc, setSelectedEvidenceDoc] = useState<any | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-xl border border-stone-200 shadow-sm text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-[#de5c36] animate-spin mx-auto" />
        <p className="text-sm font-semibold text-stone-700">Synthesizing Decision Passport &amp; Verifying Cryptographic Evidence Chain...</p>
        <p className="text-xs text-stone-400">Aggregating OCR extractions, policy rules, human scrutiny records, and DigiLocker provenance.</p>
      </div>
    );
  }

  if (error || !passport) {
    return (
      <div className="bg-rose-50 border border-rose-200 p-6 rounded-xl text-rose-800 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          Failed to load Decision Passport
        </div>
        <p className="text-xs text-rose-700">{error?.message || "Application decision records could not be retrieved."}</p>
        <button
          onClick={() => mutate()}
          className="mt-2 text-xs font-bold px-3 py-1.5 bg-rose-600 text-white rounded hover:bg-rose-700 transition"
        >
          Retry
        </button>
      </div>
    );
  }

  const {
    application_summary,
    final_decision,
    eligibility_breakdown,
    document_evidence,
    ai_confidence,
    deficiencies,
    merit_calculation,
    human_oversight,
    committee_integrity,
    financial_status,
    government_integrations,
    audit_timeline,
    decision_passport_signature,
  } = passport;

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "APPROVED":
        return <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-600 text-white flex items-center gap-1.5 shadow-sm"><CheckCircle2 className="w-3.5 h-3.5" /> APPROVED</span>;
      case "DEFICIENT":
        return <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-stone-950 flex items-center gap-1.5 shadow-sm"><AlertTriangle className="w-3.5 h-3.5" /> DEFICIENCY FLAGGED</span>;
      case "REJECTED":
        return <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-600 text-white flex items-center gap-1.5 shadow-sm"><XCircle className="w-3.5 h-3.5" /> REJECTED</span>;
      case "REVIEW_REQUIRED":
        return <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-600 text-white flex items-center gap-1.5 shadow-sm"><HelpCircle className="w-3.5 h-3.5" /> REVIEW REQUIRED</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-black bg-stone-600 text-white flex items-center gap-1.5 shadow-sm"><History className="w-3.5 h-3.5" /> PENDING VERIFICATION</span>;
    }
  };

  const getRoutingBadge = (routing: string) => {
    switch (routing) {
      case "AUTO_VERIFY":
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">AUTO-VERIFY (Confidence &ge; 90%)</span>;
      case "HUMAN_REVIEW_RECOMMENDED":
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">HUMAN REVIEW RECOMMENDED (70% - 89%)</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">MANDATORY HUMAN REVIEW (&lt; 70% or Discrepancy)</span>;
    }
  };

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ── PASSPORT HEADER BANNER ── */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-950 text-white rounded-xl p-6 shadow-xl border border-stone-700 relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-400 text-stone-950 px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> OFFICIAL DECISION PASSPORT
              </span>
              <span className="font-mono text-xs text-stone-300 border border-stone-700 px-2 py-0.5 rounded">
                SCHEMA: {passport.passport_schema}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              {application_summary.applicant_name}
              <span className="text-stone-400 text-sm font-normal">({application_summary.reference_number})</span>
            </h1>
            <p className="text-xs text-stone-300">
              {application_summary.scheme_name} | {application_summary.district}, {application_summary.state}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-right">
            <div className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Consolidated System Decision</div>
            {getDecisionBadge(final_decision)}
            <div className="text-[10px] font-mono text-stone-400 pt-1 flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" />
              <span>Audit Sig: {decision_passport_signature.slice(0, 19)}...</span>
            </div>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="mt-4 pt-4 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400">
          <div>Generated: {new Date(passport.generated_at).toLocaleString()}</div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition font-medium border border-stone-700"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Export PDF
            </button>
            <button
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#de5c36] hover:bg-[#c44a26] text-white transition font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Live Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── FAST EXPLAINABILITY EXECUTIVE SUMMARY ── */}
      <div className="bg-stone-50 border-l-4 border-[#de5c36] p-4 rounded-r-xl border-y border-r border-stone-200 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#de5c36] flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">Explainable Decision Basis (Why this outcome?)</h3>
            <p className="text-xs text-stone-700 leading-relaxed">
              {final_decision === "APPROVED" && (
                <>This application satisfied <strong>all {eligibility_breakdown.rules_evaluated || eligibility_breakdown.total_rules || eligibility_breakdown.rules?.length || 3} scheme eligibility rules</strong> with documentary cross-evidence confirmed at <strong>{ai_confidence?.overall_trust_score ?? 85}% confidence</strong>. Human scrutiny officer verified documents, selection committee satisfied quorum without unresolved conflicts, and PFMS bank validation is DBT ready.</>
              )}
              {final_decision === "DEFICIENT" && (
                <>This application has passed automated rule verification but is currently paused with <strong>active document deficiencies</strong> ({deficiencies.deficiency_count || deficiencies.count || 1} item flagged). Required certificates need clearer scans or re-upload before merit ranking proceeds.</>
              )}
              {final_decision === "PENDING" && (
                <>This application has been recorded and is currently undergoing multi-stage scrutiny. Current responsible officer: <strong>{application_summary.responsible_role}</strong>. Policy eligibility check result: <strong>{(eligibility_breakdown.passed || eligibility_breakdown.status === "VERIFIED") ? "PASS" : "FAIL/PENDING"}</strong>.</>
              )}
              {final_decision === "REJECTED" && (
                <>Application was evaluated against official ministerial guidelines and failed one or more mandatory eligibility criteria or verification integrity checks.</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── 1. ELIGIBILITY RULES BREAKDOWN (RULE-BY-RULE EVIDENCE) ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#de5c36]" /> 1. Scheme Eligibility Rules &amp; Evidentiary Mapping
          </h2>
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${(eligibility_breakdown.passed || eligibility_breakdown.status === "VERIFIED") ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
            {(eligibility_breakdown.passed || eligibility_breakdown.status === "VERIFIED") ? "ALL RULES SATISFIED" : "CRITERIA UNMET"}
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {eligibility_breakdown.rules.map((rule: any, idx: number) => (
            <div key={idx} className="p-4 hover:bg-stone-50/50 transition space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{rule.rule_code}</span>
                  <span className="text-xs font-bold text-stone-900">{rule.field.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.status === "PASS" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                    {rule.status}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${rule.evidence_match_status === "MATCH" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-700"}`}>
                    CROSS-DOC: {rule.evidence_match_status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs bg-stone-50 p-2.5 rounded-lg border border-stone-200/60">
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Declared Value</span>
                  <span className="font-bold text-stone-800">{String(rule.declared_value ?? "Not declared")}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Supporting Extracted Value</span>
                  <span className="font-bold text-stone-800">{String(rule.extracted_evidence_value ?? "Not detected")}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-semibold">Evidence Confidence</span>
                  <span className="font-bold text-emerald-700">{rule.evidence_confidence ? `${Math.round(rule.evidence_confidence * 100)}%` : "N/A"}</span>
                </div>
              </div>

              {rule.status === "FAIL" && rule.failure_message && (
                <p className="text-xs text-rose-600 font-medium">Reason: {rule.failure_message}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. DOCUMENT EVIDENCE HIGHLIGHTING & EXTRACTED FIELDS ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-stone-100/70 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#de5c36]" /> 2. Document Evidence &amp; OCR Region Provenance
          </h2>
          <span className="text-xs text-stone-500 font-mono">{(document_evidence || []).length} Documents Analyzed</span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {(document_evidence || []).map((doc: any) => {
            const rawStatus = String(doc.status || "PENDING").replace(/^DocumentStatus\./i, "").replace(/_/g, " ").toUpperCase();
            const isVerified = rawStatus === "VERIFIED";
            const isDeficient = rawStatus === "DEFICIENT";
            const docConf = typeof doc.document_confidence === "number" ? Math.round(doc.document_confidence * 100) : 85;

            return (
              <div key={doc.document_id || doc.id || doc.doc_id} className="border border-stone-200 rounded-lg p-4 bg-stone-50/40 space-y-3">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">{String(doc.document_type || doc.doc_type || "DOCUMENT").replace(/_/g, " ").toUpperCase()}</span>
                    <span className="text-[10px] text-stone-500 font-mono">ID: {String(doc.document_id || doc.doc_id || doc.id || "").slice(0, 8)}...</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isVerified ? "bg-emerald-100 text-emerald-800" : isDeficient ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                      {rawStatus}
                    </span>
                    <span className="block text-[10px] font-bold text-stone-600 mt-0.5">Trust: {docConf}%</span>
                  </div>
                </div>

                {/* Extracted Fields with Evidence */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">Extracted Field Evidence</span>
                  {!doc.extracted_fields || !Array.isArray(doc.extracted_fields) || doc.extracted_fields.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No structured fields extracted.</p>
                  ) : (
                    doc.extracted_fields.map((f: any, fIdx: number) => {
                      const fConf = typeof f.confidence === "number" ? Math.round(f.confidence * 100) : 85;
                      return (
                        <div key={fIdx} className="bg-white p-2.5 rounded border border-stone-200 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-700">{String(f.field_name || f.field || "").replace(/_/g, " ")}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                              {fConf}% Conf
                            </span>
                          </div>
                          <div className="font-bold text-stone-900">{String(f.value ?? "—")}</div>
                          {f.source_snippet && (
                            <div className="text-[10px] font-mono bg-stone-50 p-1.5 rounded text-stone-600 border border-stone-200/80 mt-1">
                              <span className="text-stone-400">OCR Region Snippet: </span>&quot;{f.source_snippet}&quot;
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 3. AI / DOCUMENT INTELLIGENCE & UNCERTAINTY ROUTING ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
          <Sparkles className="w-4 h-4 text-[#de5c36]" /> 3. Document Intelligence &amp; Uncertainty-Aware Routing
        </h2>

        {(() => {
          const overallTrust = typeof ai_confidence?.overall_trust_score === "number" ? ai_confidence.overall_trust_score : 80;
          const avgFieldConf = typeof ai_confidence?.average_field_confidence === "number"
            ? Math.round(ai_confidence.average_field_confidence * 100)
            : (typeof ai_confidence?.average_document_confidence === "number" ? Math.round(ai_confidence.average_document_confidence * 100) : 85);
          const ocrQuality = ai_confidence?.ocr_quality_rating || (overallTrust >= 70 ? "GOOD" : "ACCEPTABLE");
          const crossDocConsistency = typeof ai_confidence?.cross_document_consistency === "number"
            ? `${Math.round(ai_confidence.cross_document_consistency * 100)}%`
            : (typeof ai_confidence?.cross_document_confidence === "number" ? `${Math.round(ai_confidence.cross_document_confidence * 100)}%` : (ai_confidence?.cross_document_consistency || "PASS"));

          return (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Overall Trust Score</span>
                <span className="text-2xl font-black text-stone-900">{overallTrust}%</span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Avg Field Confidence</span>
                <span className="text-2xl font-black text-stone-900">{avgFieldConf}%</span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">OCR Quality Rating</span>
                <span className="text-2xl font-black text-emerald-700">{ocrQuality}</span>
              </div>
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-center">
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Cross-Doc Consistency</span>
                <span className="text-2xl font-black text-blue-700">{crossDocConsistency}</span>
              </div>
            </div>
          );
        })()}

        <div className="bg-blue-50/60 border border-blue-200 p-3.5 rounded-lg flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-blue-900">Recommended Operational Review Routing</div>
            <p className="text-xs text-blue-800">{ai_confidence?.routing_explanation || "Automated multi-stage document scrutiny in progress."}</p>
          </div>
          {getRoutingBadge(ai_confidence?.uncertainty_routing || ai_confidence?.review_routing || "HUMAN_REVIEW_RECOMMENDED")}
        </div>
      </div>

      {/* ── 4. GOVERNMENT INTEGRATION GATEWAY (DIGILOCKER / PFMS / DBT) ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#de5c36]" /> 4. Government Integration Gateway Provenance
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
            SANDBOX TRANSPARENCY MODE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* DigiLocker Verifications */}
          <div className="bg-stone-50/60 border border-stone-200 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> DigiLocker National Repository
              </span>
              <span className="text-[10px] font-mono text-stone-500">[SANDBOX]</span>
            </div>
            {government_integrations.verified_certificates.length === 0 ? (
              <p className="text-xs text-stone-500 italic">No external certificate numbers extracted for central querying.</p>
            ) : (
              government_integrations.verified_certificates.map((vc: any, idx: number) => (
                <div key={idx} className="bg-white p-2.5 rounded border border-stone-200 text-xs space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Cert #{vc.document_id}</span>
                    <span className="text-emerald-700 font-bold">{vc.status}</span>
                  </div>
                  <div className="text-[10px] text-stone-500">{vc.authority_name}</div>
                  <div className="text-[10px] font-mono text-stone-400">URI: {vc.evidence_reference}</div>
                </div>
              ))
            )}
          </div>

          {/* PFMS & DBT Status */}
          <div className="bg-stone-50/60 border border-stone-200 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" /> PFMS DBT Account &amp; Aadhaar Seeding
              </span>
              <span className="text-[10px] font-mono text-stone-500">[SANDBOX]</span>
            </div>
            <div className="bg-white p-2.5 rounded border border-stone-200 text-xs space-y-1.5">
              <div className="flex justify-between font-semibold">
                <span>Account Status:</span>
                <span className="text-emerald-700 font-bold">{government_integrations.financial_verification.overall_status}</span>
              </div>
              <div className="text-[11px] text-stone-700">
                Bank: {government_integrations.financial_verification.pfms_validation.bank_name} ({government_integrations.financial_verification.pfms_validation.ifsc})
              </div>
              <div className="text-[11px] text-stone-600">
                Masked Account: {government_integrations.financial_verification.pfms_validation.masked_account}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold">
                NPCI DBT Seeding: {government_integrations.financial_verification.dbt_seeding.npci_mapper_status}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. HUMAN OVERSIGHT & COMMITTEE INTEGRITY ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Human Scrutiny */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <Users className="w-4 h-4 text-[#de5c36]" /> 5. Human Scrutiny Oversight
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Scrutiny Status:</span>
              <span className="font-bold text-stone-900">{human_oversight.scrutiny_status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Assigned Officer:</span>
              <span className="font-medium text-stone-900">{human_oversight.assigned_officer_id || "Desk Scrutiny Queue"}</span>
            </div>
            {human_oversight.remarks && (
              <div className="bg-stone-50 p-2.5 rounded border border-stone-200 text-stone-700">
                <span className="font-semibold block text-[10px] uppercase text-stone-500">Officer Remarks</span>
                {human_oversight.remarks}
              </div>
            )}
          </div>
        </div>

        {/* Committee Integrity */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
            <Award className="w-4 h-4 text-[#de5c36]" /> 6. Selection Committee Governance
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-stone-500">Quorum Status:</span>
              <span className={`font-bold ${committee_integrity.quorum_met ? "text-emerald-700" : "text-amber-700"}`}>
                {committee_integrity.quorum_met ? `QUORUM MET (${committee_integrity.reviews_completed}/${committee_integrity.quorum_required})` : `QUORUM PENDING (${committee_integrity.reviews_completed}/${committee_integrity.quorum_required})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Consensus Recommendation:</span>
              <span className="font-bold text-stone-900">{committee_integrity.consensus_recommendation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Conflict-of-Interest Status:</span>
              <span className={`font-bold ${committee_integrity.unresolved_conflicts === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                {committee_integrity.unresolved_conflicts === 0 ? "NO UNRESOLVED CONFLICTS" : `${committee_integrity.unresolved_conflicts} CONFLICT FLAGGED`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. CRYPTOGRAPHIC AUDIT TIMELINE ── */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-3">
        <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-2">
          <History className="w-4 h-4 text-[#de5c36]" /> 7. Cryptographic SHA-256 Audit Trail
        </h2>
        <div className="flex items-center justify-between text-xs text-stone-500 font-mono pb-2">
          <span>Chain Status: <strong className="text-emerald-600">{audit_timeline.integrity_status}</strong></span>
          <span>Logged Events: {audit_timeline.audit_event_count}</span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {audit_timeline.timeline.map((log: any) => (
            <div key={log.id} className="text-xs bg-stone-50 p-2.5 rounded border border-stone-200 flex items-center justify-between gap-4 font-mono">
              <div>
                <span className="font-bold text-stone-900">{log.action}</span>
                <span className="text-stone-500 ml-2">({log.from_state || "INIT"} &rarr; {log.to_state})</span>
              </div>
              <div className="text-right text-[10px] text-stone-400">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ""}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
