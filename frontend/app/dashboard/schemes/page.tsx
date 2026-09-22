"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getSchemes, activateScheme, deactivateScheme, type SchemeRead } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Sliders, Plus, CheckCircle2, XCircle, Power, Edit, Loader2, ArrowRight } from "lucide-react";

export default function SchemesPage() {
  const { user } = useAuth();
  const { data: schemes, isLoading, mutate } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (scheme: SchemeRead) => {
    setToggling(scheme.id);
    try {
      if (scheme.is_active) await deactivateScheme(scheme.id);
      else await activateScheme(scheme.id);
      mutate();
    } catch (err: any) { alert(err?.message || "Failed"); } finally { setToggling(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#de5c36]" /> Scheme Configurator
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Manage scholarship &amp; fellowship scheme configurations</p>
        </div>
        <Link href="/dashboard/schemes/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition">
          <Plus className="w-4 h-4" /> Create New Scheme
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>
        ) : !schemes || schemes.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">No schemes configured yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Scheme Code</th><th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Status</th><th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {schemes.map((scheme) => (
                  <tr key={scheme.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-5 py-3 font-mono text-[11px] font-bold text-[#de5c36]">{scheme.code}</td>
                    <td className="px-5 py-3 font-medium text-gray-800">{scheme.name}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        scheme.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"
                      }`}>
                        {scheme.is_active ? <><CheckCircle2 className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">{new Date(scheme.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/schemes/${scheme.id}`}
                          className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200">
                          View
                        </Link>
                        <Link href={`/dashboard/schemes/${scheme.id}/edit`}
                          className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200">
                          <Edit className="w-3 h-3 inline mr-0.5" />Edit
                        </Link>
                        <button onClick={() => handleToggle(scheme)} disabled={toggling === scheme.id}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded border transition disabled:opacity-50 ${
                            scheme.is_active ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200" : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                          }`}>
                          {toggling === scheme.id ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <Power className="w-3 h-3 inline mr-0.5" />}
                          {scheme.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
