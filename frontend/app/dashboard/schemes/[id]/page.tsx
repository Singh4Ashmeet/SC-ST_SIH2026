"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { getScheme, type SchemeRead } from "@/lib/api";
import { ArrowLeft, Sliders, Edit, CheckCircle2, XCircle, Layers, FileText, ShieldCheck } from "lucide-react";

export default function SchemeDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: scheme, isLoading } = useSWR<SchemeRead>(id ? `/api/schemes/${id}` : null, () => getScheme(id));

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!scheme) return <div className="p-8 text-center text-gray-400">Scheme not found.</div>;

  const config = scheme.config || {};
  const workflowStates = config.workflow_states || [];
  const eligRules = config.eligibility_rules || [];
  const reqDocs = config.required_documents || [];
  const transitions = config.workflow_transitions || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/schemes" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes</Link>
        <Link href={`/dashboard/schemes/${id}/edit`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition"><Edit className="w-3.5 h-3.5" /> Edit Scheme</Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#e7d8c6] via-[#dfccb7] to-[#d6bc9f] rounded-xl p-6 border border-[#cfbfa9] shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[#de5c36] px-2 py-0.5 rounded bg-white/60 border border-[#de5c36]/30">{scheme.code}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${scheme.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                {scheme.is_active ? <><CheckCircle2 className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight pt-1">{scheme.name}</h1>
            {scheme.description && <p className="text-xs text-stone-600 mt-1">{scheme.description}</p>}
          </div>
          <div className="text-xs text-stone-500">Created: {new Date(scheme.created_at).toLocaleDateString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Eligibility Rules */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-3"><ShieldCheck className="w-3.5 h-3.5 text-[#de5c36]" /> Eligibility Rules ({eligRules.length})</h3>
          {eligRules.length > 0 ? (
            <div className="space-y-2">
              {eligRules.map((r: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-xs">
                  <div className="font-medium text-gray-800">Field: <span className="font-mono text-[#de5c36]">{r.field}</span></div>
                  <div className="text-gray-500 mt-0.5">Condition: {JSON.stringify(r.condition)}</div>
                  {r.failure_message && <div className="text-rose-500 mt-0.5 text-[11px]">{r.failure_message}</div>}
                </div>
              ))}
            </div>
          ) : <div className="text-gray-400 text-xs">No rules defined.</div>}
        </div>

        {/* Required Documents */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-3"><FileText className="w-3.5 h-3.5 text-[#de5c36]" /> Required Documents ({reqDocs.length})</h3>
          {reqDocs.length > 0 ? (
            <div className="space-y-2">
              {reqDocs.map((d: any, i: number) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-xs flex items-center justify-between">
                  <div><span className="font-medium text-gray-800">{d.label || d.doc_type}</span><span className="ml-2 font-mono text-[11px] text-gray-400">{d.doc_type}</span></div>
                  <span className={`text-[10px] font-medium ${d.required ? "text-rose-600" : "text-gray-400"}`}>{d.required ? "Required" : "Optional"}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-gray-400 text-xs">No documents required.</div>}
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5 mb-4"><Layers className="w-3.5 h-3.5 text-[#de5c36]" /> Workflow States ({workflowStates.length})</h3>
        <div className="flex items-center justify-start gap-2 overflow-x-auto pb-2">
          {workflowStates.map((st: any, i: number) => (
            <React.Fragment key={st.name}>
              <div className="flex flex-col items-center text-center min-w-[100px]">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${st.is_terminal ? "bg-emerald-600 text-white border-emerald-500" : "bg-white text-gray-600 border-gray-300"}`}>{i + 1}</div>
                <span className="text-[10px] font-medium text-gray-700 mt-1">{st.label || st.name}</span>
              </div>
              {i < workflowStates.length - 1 && <div className="w-6 h-0.5 bg-gray-300 -mt-4" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Raw Config */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Raw Configuration JSON</h3>
        <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-[11px] font-mono text-gray-700 overflow-x-auto max-h-60">{JSON.stringify(config, null, 2)}</pre>
      </div>
    </div>
  );
}
