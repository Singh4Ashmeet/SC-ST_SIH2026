"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { getScheme, updateScheme, validateConfig, type SchemeRead, type ValidateConfigResponse } from "@/lib/api";
import { ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, Code, ShieldCheck } from "lucide-react";

export default function EditSchemePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: scheme, isLoading } = useSWR<SchemeRead>(id ? `/api/schemes/${id}` : null, () => getScheme(id));

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configJson, setConfigJson] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidateConfigResponse | null>(null);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (scheme && !initialized) {
    setName(scheme.name); setDescription(scheme.description || "");
    setConfigJson(JSON.stringify(scheme.config || {}, null, 2));
    setInitialized(true);
  }

  const handleValidate = async () => {
    setJsonParseError(null); setValidationResult(null);
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configJson); } catch { setJsonParseError("Invalid JSON"); return; }
    setIsValidating(true);
    try { const res = await validateConfig(parsed); setValidationResult(res); } catch (err: any) { setJsonParseError(err?.message || "Failed"); } finally { setIsValidating(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(configJson); } catch { setJsonParseError("Invalid JSON"); return; }
    setIsSubmitting(true);
    try {
      await updateScheme(id, { name: name.trim(), description: description.trim(), config: parsed });
      router.push(`/dashboard/schemes/${id}`);
    } catch (err: any) { alert(err?.message || "Failed"); } finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!scheme) return <div className="p-8 text-center text-gray-400">Scheme not found.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link href={`/dashboard/schemes/${id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Scheme</Link>
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Edit Scheme: {scheme.code}</h2>
        <p className="text-xs text-gray-500 mt-0.5">Modify scheme configuration, eligibility rules, and workflow</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Basic Information</h3>
          <div>
            <label className="text-[11px] text-gray-500 font-medium">Scheme Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Code className="w-4 h-4 text-[#de5c36]" /> Configuration JSON</h3>
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
              {validationResult.valid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Valid</> : <><AlertCircle className="w-3.5 h-3.5" /> {validationResult.errors?.join(", ") || "Invalid"}</>}
            </div>
          )}
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full py-3 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-sm transition disabled:opacity-50">
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
