"use client";

import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  getAuditLogs,
  verifyAuditHashChain,
  simulateAuditTampering,
  restoreAuditTampering,
  type AuditLogListResponse,
  type AuditVerificationResult,
} from "@/lib/api";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Hash,
  Lock,
} from "lucide-react";

export default function GlobalAuditLogPage() {
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useSWR<AuditLogListResponse>(
    `/api/audit-log?page=${page}&page_size=${pageSize}`,
    () => getAuditLogs({ page, page_size: pageSize })
  );

  const [verificationResult, setVerificationResult] = useState<AuditVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  async function handleVerify() {
    setIsVerifying(true);
    try {
      const res = await verifyAuditHashChain();
      setVerificationResult(res);
    } catch (err: any) {
      console.error("Verification failed", err);
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleSimulateTamper() {
    setIsTampering(true);
    setTamperMessage(null);
    try {
      const res = await simulateAuditTampering();
      setTamperMessage(res.message);
      // Automatically re-verify to display the broken chain detection immediately
      const verifyRes = await verifyAuditHashChain();
      setVerificationResult(verifyRes);
      mutate(`/api/audit-log?page=${page}&page_size=${pageSize}`);
    } catch (err: any) {
      console.error("Tamper simulation failed", err);
    } finally {
      setIsTampering(false);
    }
  }

  async function handleRestore() {
    setIsRestoring(true);
    try {
      const res = await restoreAuditTampering();
      setTamperMessage(`Restored: ${res.message}`);
      const verifyRes = await verifyAuditHashChain();
      setVerificationResult(verifyRes);
      mutate(`/api/audit-log?page=${page}&page_size=${pageSize}`);
    } catch (err: any) {
      console.error("Restore failed", err);
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#de5c36]" /> Cryptographic Audit Ledger & Chain of Custody
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Every state transition and officer action is cryptographically sealed into an append-only SHA-256 hash chain (Phase 14 & 15).
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600 bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100 transition disabled:opacity-50"
          >
            <ShieldCheck className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
            {isVerifying ? "Verifying Chain..." : "Verify Hash Chain"}
          </button>

          <button
            onClick={handleSimulateTamper}
            disabled={isTampering}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition disabled:opacity-50"
            title="Safe judge demonstration: temporarily alter a record to prove tamper detection"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            Simulate Tampering (Demo)
          </button>

          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? "animate-spin" : ""}`} />
            Restore & Re-Verify
          </button>
        </div>
      </div>

      {/* Verification Results Panel */}
      {verificationResult && (
        <div
          className={`rounded-xl border p-4 transition ${
            verificationResult.is_valid
              ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
              : "bg-red-50 border-red-200 text-red-950"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {verificationResult.is_valid ? (
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-red-100 text-red-700 animate-pulse">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm">
                    {verificationResult.is_valid
                      ? "CRYPTOGRAPHIC AUDIT CHAIN VERIFIED"
                      : "INTEGRITY VIOLATION DETECTED"}
                  </h3>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      verificationResult.is_valid
                        ? "bg-emerald-200 text-emerald-800"
                        : "bg-red-200 text-red-800"
                    }`}
                  >
                    {verificationResult.status}
                  </span>
                </div>
                <p className="text-xs mt-0.5 opacity-90">{verificationResult.message}</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 text-center border-l pl-4 border-gray-200/60">
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-500">Events Checked</p>
                <p className="text-base font-bold font-mono text-gray-900">
                  {verificationResult.total_events}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-500">Broken Links</p>
                <p
                  className={`text-base font-bold font-mono ${
                    verificationResult.broken_links_count > 0 ? "text-red-600 font-extrabold" : "text-emerald-700"
                  }`}
                >
                  {verificationResult.broken_links_count}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-500">Invalid Hashes</p>
                <p
                  className={`text-base font-bold font-mono ${
                    verificationResult.invalid_hashes_count > 0 ? "text-red-600 font-extrabold" : "text-emerald-700"
                  }`}
                >
                  {verificationResult.invalid_hashes_count}
                </p>
              </div>
            </div>
          </div>

          {/* Tamper Details if Broken */}
          {!verificationResult.is_valid && (
            <div className="mt-3 pt-3 border-t border-red-200/70 text-xs grid grid-cols-1 md:grid-cols-3 gap-2 font-mono">
              <div className="p-2 bg-white/80 rounded border border-red-200">
                <span className="text-[10px] uppercase text-gray-500 block font-sans">Compromised Event ID:</span>
                <span className="text-red-800 font-bold">{verificationResult.first_broken_log_id || "N/A"}</span>
              </div>
              <div className="p-2 bg-white/80 rounded border border-red-200">
                <span className="text-[10px] uppercase text-gray-500 block font-sans">Expected SHA-256 Hash:</span>
                <span className="text-emerald-700 truncate block text-[11px]">
                  {verificationResult.expected_hash || "N/A"}
                </span>
              </div>
              <div className="p-2 bg-white/80 rounded border border-red-200">
                <span className="text-[10px] uppercase text-gray-500 block font-sans">Stored Hash (Tampered):</span>
                <span className="text-red-600 truncate block text-[11px]">
                  {verificationResult.found_hash || "N/A"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      {tamperMessage && (
        <div className="text-xs px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-center gap-2">
          <Hash className="w-4 h-4 text-blue-600" />
          <span>{tamperMessage}</span>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            No audit records found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Application</th>
                  <th className="px-5 py-3">Transition</th>
                  <th className="px-5 py-3">User / Actor</th>
                  <th className="px-5 py-3">Current Hash (SHA-256)</th>
                  <th className="px-5 py-3">Previous Hash</th>
                  <th className="px-5 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((log: any) => {
                  const isTamperedRow =
                    verificationResult &&
                    !verificationResult.is_valid &&
                    verificationResult.first_broken_log_id === log.id;

                  return (
                    <tr
                      key={log.id}
                      className={`transition ${
                        isTamperedRow
                          ? "bg-red-50/90 border-l-4 border-l-red-500 font-medium"
                          : "hover:bg-gray-50/70"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-gray-400" />
                          <span className="font-semibold text-gray-800 uppercase text-[11px]">
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[11px] text-gray-500">
                        {log.application_id ? log.application_id.slice(0, 14) : "—"}
                      </td>
                      <td className="px-5 py-3 text-[11px]">
                        {log.from_state || log.to_state ? (
                          <span className="text-gray-500">
                            {log.from_state || "—"} →{" "}
                            <span className="text-[#de5c36] font-medium">{log.to_state || "—"}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-[11px]">
                        {log.actor_user_id ? log.actor_user_id.slice(0, 8) : "system"}
                      </td>
                      <td className="px-5 py-3 font-mono text-[10px] text-gray-600">
                        {log.current_hash ? (
                          <span
                            className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 cursor-help"
                            title={log.current_hash}
                          >
                            {log.current_hash.slice(0, 12)}…
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">legacy</span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-mono text-[10px] text-gray-400">
                        {log.previous_hash ? (
                          <span className="cursor-help" title={log.previous_hash}>
                            {log.previous_hash.slice(0, 10)}…
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-400">
              Page {page} of {totalPages} ({data.total.toLocaleString()} total audit entries)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
