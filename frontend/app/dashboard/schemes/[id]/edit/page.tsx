"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  getScheme,
  updateScheme,
  validateConfig,
  type SchemeRead,
  type ValidateConfigResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  Check,
  RefreshCw,
  Loader2,
  Code,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditSchemePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { data: scheme, isLoading: schemeLoading } = useSWR<SchemeRead>(
    id ? `/api/schemes/${id}` : null,
    () => getScheme(id)
  );

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configJson, setConfigJson] = useState("");

  const [validationResult, setValidationResult] = useState<ValidateConfigResponse | null>(null);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize fields once scheme is loaded
  useEffect(() => {
    if (scheme) {
      setName(scheme.name);
      setDescription(scheme.description || "");
      setConfigJson(JSON.stringify(scheme.config, null, 2));
    }
  }, [scheme]);

  const handleValidate = async () => {
    setJsonParseError(null);
    setValidationResult(null);

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (err: unknown) {
      setJsonParseError(
        err instanceof Error ? err.message : "Invalid JSON syntax. Please verify JSON format."
      );
      return;
    }

    setIsValidating(true);
    try {
      const res = await validateConfig(parsedConfig);
      setValidationResult(res);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setJsonParseError(err.message);
      } else {
        setJsonParseError("Failed to communicate with schema validator.");
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(configJson);
    } catch (err: unknown) {
      setJsonParseError("Cannot save invalid JSON. Please check syntax.");
      return;
    }

    setIsSaving(true);
    try {
      await updateScheme(id, {
        name: name.trim(),
        description: description.trim(),
        config: parsedConfig,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/schemes/${id}`);
      }, 800);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update scheme");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (scheme) {
      setName(scheme.name);
      setDescription(scheme.description || "");
      setConfigJson(JSON.stringify(scheme.config, null, 2));
      setValidationResult(null);
      setJsonParseError(null);
    }
  };

  if (schemeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="p-8 text-center text-slate-400">
        Scheme not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/schemes/${id}`}>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Details
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-slate-800 text-slate-400 hover:text-white text-xs h-8"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>

          <Button
            id="validate-config-btn"
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
            id="save-scheme-btn"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || (validationResult !== null && !validationResult.valid)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 shadow-md shadow-indigo-600/20"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            {saveSuccess ? "Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Edit Scheme Configuration</h1>
          <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
            {scheme.code}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Modify scheme metadata and declarative JSON schema controlling rules, documents, and workflows
        </p>
      </div>

      {/* Basic Metadata Card */}
      <Card className="bg-slate-900/60 border-slate-800 text-slate-100 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="scheme-name" className="text-xs font-medium text-slate-300">
              Scheme Name
            </Label>
            <Input
              id="scheme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950/70 border-slate-700/80 text-xs text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scheme-code" className="text-xs font-medium text-slate-300">
              Scheme Code (Immutable)
            </Label>
            <Input
              id="scheme-code"
              value={scheme.code}
              disabled
              className="bg-slate-950/30 border-slate-800 text-xs text-slate-500 font-mono cursor-not-allowed"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="scheme-description" className="text-xs font-medium text-slate-300">
            Scheme Description
          </Label>
          <Textarea
            id="scheme-description"
            rows={2}
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
            <span className="text-xs font-semibold text-white">Declarative Scheme Config (JSON)</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Defines eligibility_rules, required_documents, workflow_states, workflow_transitions
          </span>
        </div>

        <Textarea
          id="config-json-editor"
          rows={22}
          value={configJson}
          onChange={(e) => {
            setConfigJson(e.target.value);
            // Invalidate validation status on edit
            if (validationResult) setValidationResult(null);
            if (jsonParseError) setJsonParseError(null);
          }}
          className="font-mono text-xs bg-slate-950 border-slate-800 text-slate-200 leading-relaxed focus-visible:ring-indigo-500/50 p-4"
          spellCheck={false}
        />

        {/* JSON Syntax Error alert */}
        {jsonParseError && (
          <div id="json-parse-error-alert" className="p-3 bg-red-950/50 border border-red-800/80 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-red-200">JSON Syntax Error:</div>
              <div className="font-mono text-[11px] mt-0.5">{jsonParseError}</div>
            </div>
          </div>
        )}

        {/* Validation Result Box */}
        {validationResult && (
          <div
            id="validation-result-alert"
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
                  ? "Schema Validation Passed: Configuration is strictly valid."
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
