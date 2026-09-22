"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createScheme, validateConfig, type ValidateConfigResponse } from "@/lib/api";
import { ArrowLeft, CheckCircle2, AlertCircle, Plus, Loader2, Code, ShieldCheck } from "lucide-react";

const STARTER_CONFIG = {
  scheme_code: "DEMO_SCHEME",
  version: 1,
  eligibility_rules: [
    { field: "category", condition: { eq: "ST" }, failure_message: "Applicant must belong to Scheduled Tribe (ST) category" },
    { field: "annual_family_income", condition: { lte: 600000 }, failure_message: "Family income must not exceed INR 6,00,000 per annum" },
  ],
  required_documents: [
    { doc_type: "caste_certificate", label: "Caste / Tribe Certificate", required: true, accepted_formats: ["pdf", "jpg", "png"], validity_days: null },
    { doc_type: "income_certificate", label: "Annual Income Certificate", required: true, accepted_formats: ["pdf"], validity_days: 365 },
  ],
  workflow_states: [
    { name: "submitted", label: "Application Submitted", is_terminal: false },
    { name: "eligibility_check", label: "Eligibility Verification", is_terminal: false },
    { name: "document_scrutiny", label: "Document Scrutiny", is_terminal: false },
    { name: "selection", label: "Selection Committee Review", is_terminal: false },
    { name: "approved", label: "Award Approved", is_terminal: true },
    { name: "rejected", label: "Rejected", is_terminal: true },
  ],
  workflow_transitions: [
    { from_state: "submitted", to_state: "eligibility_check", trigger: "run_eligibility", allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER"] },
    { from_state: "eligibility_check", to_state: "document_scrutiny", trigger: "eligibility_passed", allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER"] },
    { from_state: "eligibility_check", to_state: "rejected", trigger: "eligibility_failed", allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN"] },
    { from_state: "document_scrutiny", to_state: "selection", trigger: "documents_verified", allowed_roles: ["SUPER_ADMIN", "SCRUTINY_OFFICER"] },
    { from_state: "selection", to_state: "approved", trigger: "approve_award", allowed_roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"] },
  ],
  initial_state: "submitted",
};

export default function NewSchemePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configJson, setConfigJson] = useState(JSON.stringify(STARTER_CONFIG, null, 2));
  const [validationResult, setValidationResult] = useState<ValidateConfigResponse | null>(null);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidate = async () => {
    setJsonParseError(null); setValidationResult(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configJson); } catch { setJsonParseError("Invalid JSON syntax"); return; }
    setIsValidating(true);
    try {
      const res = await validateConfig(parsed);
      setValidationResult(res);
    } catch (err: any) { setJsonParseError(err?.message || "Validation failed"); } finally { setIsValidating(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configJson); } catch { setJsonParseError("Invalid JSON"); return; }
    setIsSubmitting(true);
    try {
      await createScheme({ code: code.trim(), name: name.trim(), description: description.trim(), config: parsed });
      router.push("/dashboard/schemes");
    } catch (err: any) { alert(err?.message || "Failed to create scheme"); } finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href="/dashboard/schemes" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes
      </Link>

      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Plus className="w-5 h-5 text-[#de5c36]" /> Create New Scheme
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">Define eligibility rules, required documents, and workflow configuration</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] text-gray-500 font-medium">Scheme Code *</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="e.g. NFST_2026"
                className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" />
            </div>
            <div>
              <label className="text-[11px] text-gray-500 font-medium">Scheme Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. National Fellowship for ST Students"
                className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of the scholarship/fellowship scheme..."
              className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Code className="w-4 h-4 text-[#de5c36]" /> Scheme Configuration (JSON)</h3>
            <button type="button" onClick={handleValidate} disabled={isValidating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#105a8b] hover:bg-[#0d4b74] text-white rounded-lg shadow-sm transition disabled:opacity-50">
              {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Validate
            </button>
          </div>
          <textarea value={configJson} onChange={(e) => { setConfigJson(e.target.value); setJsonParseError(null); setValidationResult(null); }}
            className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-80 bg-gray-50" spellCheck={false} />
          
          {jsonParseError && <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {jsonParseError}</div>}
          {validationResult && (
            <div className={`p-2 text-xs rounded border flex items-center gap-1.5 ${validationResult.valid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
              {validationResult.valid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Configuration is valid</> : <><AlertCircle className="w-3.5 h-3.5" /> {validationResult.errors?.join(", ") || "Invalid"}</>}
            </div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full py-3 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-sm transition disabled:opacity-50">
          {isSubmitting ? "Creating Scheme..." : "Create Scheme"}
        </button>
      </form>
    </div>
  );
}
