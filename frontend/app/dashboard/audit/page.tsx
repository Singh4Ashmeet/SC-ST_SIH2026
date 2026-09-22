"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { getAuditLogs, type AuditLogListResponse } from "@/lib/api";
import { History, ChevronLeft, ChevronRight, Shield } from "lucide-react";

export default function GlobalAuditLogPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading } = useSWR<AuditLogListResponse>(
    `/api/audit-log?page=${page}&page_size=${pageSize}`,
    () => getAuditLogs({ page, page_size: pageSize })
  );
  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#de5c36]" /> Global Audit Trail
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Immutable log of all system events and administrative actions</p>
        </div>
        <div className="text-xs text-gray-400">
          {data ? `${data.total.toLocaleString()} total records` : "Loading..."}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">No audit records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-5 py-3">Transition</th>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-5 py-3 font-semibold text-gray-800 uppercase text-[11px]">{log.action.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-gray-500">{log.application_id ? log.application_id.slice(0, 14) : "—"}</td>
                    <td className="px-5 py-3 text-[11px]">
                      {log.from_state || log.to_state ? (
                        <span className="text-gray-500">
                          {log.from_state || "—"} → <span className="text-[#de5c36] font-medium">{log.to_state || "—"}</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-[11px]">{log.actor_user_id ? log.actor_user_id.slice(0, 8) : "system"}</td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
