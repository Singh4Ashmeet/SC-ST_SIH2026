"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { getApplications, getSchemes, type ApplicationRead, type SchemeRead } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { UserCheck, Search, ArrowRight, ShieldAlert } from "lucide-react";

export default function SelectionCommitteeQueuePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const isAuthorized = user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: schemes } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const { data: applications, isLoading } = useSWR<ApplicationRead[]>(isAuthorized ? "/api/applications" : null, () => getApplications());

  const schemeMap = useMemo(() => {
    const m = new Map<string, SchemeRead>();
    schemes?.forEach((s) => m.set(s.id, s));
    return m;
  }, [schemes]);

  const selectionApps = useMemo(() => {
    if (!applications) return [];
    return applications.filter((a) => a.current_state === "selection" || a.current_state === "pending_selection");
  }, [applications]);

  const filtered = useMemo(() => {
    if (!searchQuery) return selectionApps;
    const q = searchQuery.toLowerCase();
    return selectionApps.filter((a) => a.applicant_name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
  }, [selectionApps, searchQuery]);

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center">
          <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-rose-800">Access Denied</h2>
          <p className="text-xs text-rose-500 mt-1">Restricted to Selection Committee members and Super Admins.</p>
          <Link href="/dashboard" className="inline-block mt-3 px-4 py-2 text-xs font-medium bg-white border border-rose-200 rounded-lg text-rose-700 hover:bg-rose-50">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#de5c36]" /> Selection Committee
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Review eligible candidates for approval or rejection</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-3 py-2 text-center">
          <div className="text-[10px] text-purple-600 font-medium">Pending Review</div>
          <div className="text-lg font-bold text-purple-700">{selectionApps.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#de5c36]"
            placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">No applications pending selection review</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Application ID</th><th className="px-5 py-3">Applicant</th>
                  <th className="px-5 py-3">Scheme</th><th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-5 py-3 font-medium text-gray-800 text-[11px]">{app.id.slice(0, 14).toUpperCase()}</td>
                    <td className="px-5 py-3 text-gray-700 font-medium">{app.applicant_name}</td>
                    <td className="px-5 py-3 text-gray-500 text-[11px]">{schemeMap.get(app.scheme_id)?.name || "—"}</td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">{new Date(app.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/dashboard/selection/${app.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 rounded border border-purple-200 transition">
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
