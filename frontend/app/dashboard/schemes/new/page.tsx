"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createScheme,
  validateConfig,
  type ValidateConfigResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  Code,
  ShieldCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const STARTER_CONFIG = {
  scheme_code: "DEMO_SCHEME",
  version: 1,
  eligibility_rules: [
    {
      field: "category",
      condition: { eq: "ST" },
      failure_message: "Applicant must belong to Scheduled Tribe (ST) category",
    },
    {
      field: "annual_family_income",
      condition: { lte: 600000 },
      failure_message: "Family income must not exceed INR 6,00,000 per annum",
    },
  ],
  required_documents: [
    {
      doc_type: "caste_certificate",
      label: "Caste / Tribe Certificate",
      required: true,
      accepted_formats: ["pdf", "jpg", "png"],
      validity_days: null,
    },
    {
      doc_type: "income_certificate",
      label: "Annual Income Certificate",
      required: true,
      accepted_formats: ["pdf"],
      validity_days: 365,
    },
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
    {
      from_state: "submitted",
      to_state: "eligibility_check",
      trigger: "run_eligibility",
      allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER"],
    },
    {
      from_state: "eligibility_check",
      to_state: "document_scrutiny",
      trigger: "eligibility_passed",
      allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER"],
    },
    {
      from_state: "eligibility_check",
      to_state: "rejected",
      trigger: "eligibility_failed",
      allowed_roles: ["SUPER_ADMIN", "SCHEME_ADMIN"],
    },
    {
      from_state: "document_scrutiny",
      to_state: "selection",
      trigger: "documents_verified",
      allowed_roles: ["SUPER_ADMIN", "SCRUTINY_OFFICER"],
    },
    {
      from_state: "selection",
      to_state: "approved",
      trigger: "approve_award",
      allowed_roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"],
    },
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
    setJsonParseError(null);
    setValidationResult(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson);
    } catch (err: unknown) {
      setJsonParseError(err instanceof Error ? err.message : "Invalid JSON syntax");
      return;
    }

    setIsValidating(true);
    try {
      const res = await validateConfig(parsed);
      setValidationResult(res);
    } catch (err: unknown) {
      setJsonParseError(err instanceof Error ? err.message : "Validation call failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert("Please provide scheme code and name");
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configJson);
    } catch {
      setJsonParseError("Cannot save invalid JSON.");
      return;
    }

    setIsSubmitting(true);
    try {
      const newScheme = await createScheme({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        config: parsed,
        is_active: true,
      });
      router.push(`/dashboard/schemes/${newScheme.id}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create scheme");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/schemes">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Schemes
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={isValidating}
            className="border-indigo-600/50 text-indigo-300 hover:bg-indigo-950/40 text-xs h-8"
          >
            {isValidating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
            )}
            Validate Config
          </Button>

          <Button
            id="submit-create-scheme-btn"
            size="sm"
            onClick={handleCreate}
            disabled={isSubmitting || (validationResult !== null && !validationResult.valid)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 shadow-md shadow-indigo-600/20"
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : (
              <Plus className="w-3.5 h-3.5 mr-1.5" />
            )}
            Create Scheme
          </Button>
        </div>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Create New Scheme</h1>
        <p className="text-xs text-slate-400 mt-1">
          Deploy a new scholarship program with custom eligibility rules and automated document scrutiny workflows
        </p>
      </div>

      {/* Metadata Card */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-scheme-code" className="text-xs font-medium text-slate-300">
              Scheme Code (e.g. NFST, NOS, PMS-SC) *
            </Label>
            <Input
              id="new-scheme-code"
              placeholder="e.g. PM-YASASVI"
              value={code}
              onChange={(e) => {
                const upper = e.target.value.toUpperCase();
                setCode(upper);
                // Also sync scheme_code in starter JSON if unchanged
                try {
                  const curr = JSON.parse(configJson);
                  curr.scheme_code = upper;
                  setConfigJson(JSON.stringify(curr, null, 2));
                } catch {
                  // ignore
                }
              }}
              required
              className="bg-slate-950/70 border-slate-700/80 text-xs text-slate-100 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-scheme-name" className="text-xs font-medium text-slate-300">
              Scheme Name *
            </Label>
            <Input
              id="new-scheme-name"
              placeholder="Full official scheme title"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-slate-950/70 border-slate-700/80 text-xs text-slate-100"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-scheme-desc" className="text-xs font-medium text-slate-300">
            Description
          </Label>
          <Textarea
            id="new-scheme-desc"
            rows={2}
            placeholder="Objectives, target beneficiary groups, and program overview..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-slate-950/70 border-slate-700/80 text-xs text-slate-100"
          />
        </div>
      </Card>

      {/* JSON Config Editor Card */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-white">Scheme Config Specification (JSON)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Customize rules, mandatory documents, and workflow transitions
          </span>
        </div>

        <Textarea
          id="new-config-json-editor"
          rows={22}
          value={configJson}
          onChange={(e) => {
            setConfigJson(e.target.value);
            if (validationResult) setValidationResult(null);
            if (jsonParseError) setJsonParseError(null);
          }}
          className="font-mono text-xs bg-slate-950 border-slate-800 text-slate-200 leading-relaxed focus-visible:ring-indigo-500/50 p-4"
          spellCheck={false}
        />

        {jsonParseError && (
          <div className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-red-200">JSON Syntax Error:</div>
              <div className="font-mono text-[11px] mt-0.5">{jsonParseError}</div>
            </div>
          </div>
        )}

        {validationResult && (
          <div
            className={`p-3 rounded-lg text-xs border flex items-start gap-2 ${
              validationResult.valid
                ? "bg-emerald-950/50 border-emerald-800/80 text-emerald-200"
                : "bg-red-950/50 border-red-800/80 text-red-200"
            }`}
          >
            {validationResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-1">
              <div className="font-semibold">
                {validationResult.valid
                  ? "Schema Validation Passed: Ready for deployment."
                  : "Schema Validation Failed:"}
              </div>
              {validationResult.errors && validationResult.errors.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5 font-mono text-[11px] text-red-300">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
