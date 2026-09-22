"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getApplications, getSchemes, type ApplicationRead, type SchemeRead } from "@/lib/api";
import { Cpu, Search, ArrowRight, AlertTriangle, Clock, Filter, ChevronDown } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const cls = status === "deficient" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export default function ScrutinyQueuePage() {
  const [filterTab, setFilterTab] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const { data: applications, isLoading } = useSWR<ApplicationRead[]>("/api/applications", () => getApplications());

  const schemeCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    schemes?.forEach((s) => map.set(s.id, s.code));
    return map;
  }, [schemes]);

  const queueApps = useMemo(() => {
    if (!applications) return [];
    return applications.filter((a) => a.current_state === "document_scrutiny" || a.current_state === "deficient");
  }, [applications]);

  const filtered = useMemo(() => {
    let list = queueApps;
    if (filterTab === "DEFICIENT") list = list.filter((a) => a.current_state === "deficient");
    else if (filterTab === "SCRUTINY") list = list.filter((a) => a.current_state === "document_scrutiny");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) => a.applicant_name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
    }
    return list;
  }, [queueApps, filterTab, searchQuery]);

  const deficientCount = queueApps.filter((a) => a.current_state === "deficient").length;
  const scrutinyCount = queueApps.filter((a) => a.current_state === "document_scrutiny").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#de5c36]" /> AI Scrutiny Queue
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">OCR-based document verification &amp; eligibility analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-amber-600 font-medium">Under Scrutiny</div>
            <div className="text-lg font-bold text-amber-700">{scrutinyCount}</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center">
            <div className="text-[10px] text-rose-600 font-medium">Deficient</div>
            <div className="text-lg font-bold text-rose-700">{deficientCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-200">
          {[{ key: "ALL", label: "All" }, { key: "SCRUTINY", label: "Under Scrutiny" }, { key: "DEFICIENT", label: "Deficient" }].map((tab) => (
            <button key={tab.key} onClick={() => setFilterTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${filterTab === tab.key ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#de5c36]"
            placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">No applications in scrutiny queue</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Application ID</th><th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Scheme</th><th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th><th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-5 py-3 font-medium text-gray-800 text-[11px]">{app.id.slice(0, 14).toUpperCase()}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{app.applicant_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-[11px]">{schemeCodeMap.get(app.scheme_id) || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge status={app.current_state} /></td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/scrutiny/${app.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition">
                        Review <ArrowRight className="w-3 h-3" />
                      </Link>
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
