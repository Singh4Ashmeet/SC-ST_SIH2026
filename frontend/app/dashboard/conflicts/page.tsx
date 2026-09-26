"use client";

import React, { useEffect, useState } from "react";
import { getConflicts, resolveConflict } from "@/lib/api";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Loader2,
  Eye,
  Filter,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  CONCURRENT_SCHOLARSHIP: "Concurrent Scholarship",
  DUPLICATE_APPLICATION: "Duplicate Application",
  REPEATED_BENEFICIARY: "Repeated Beneficiary",
  CROSS_SCHEME_INCOMPATIBILITY: "Cross-Scheme Incompatibility",
  IDENTITY_COLLISION: "Identity Collision",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-rose-50 text-rose-700 border-rose-200",
  CLEARED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  FALSE_POSITIVE: "bg-gray-50 text-gray-500 border-gray-200",
};

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getConflicts({ status_filter: statusFilter || undefined });
      setConflicts((res as any)?.conflicts || []);
    } catch (err) {
      console.error("Failed to load conflicts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleResolve = async (id: string, status: string) => {
    setActioning(id);
    try {
      await resolveConflict(id, {
        status,
        resolution_remarks: `Resolved as ${status.replace(/_/g, " ").toLowerCase()} by officer`,
      });
      await fetchData();
    } catch (err) {
      alert("Failed to resolve conflict");
    } finally {
      setActioning(null);
    }
  };

  const pendingCount = conflicts.filter((c) => c.status === "PENDING_REVIEW").length;
  const confirmedCount = conflicts.filter((c) => c.status === "CONFIRMED").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#de5c36]" />
          Cross-Scheme Conflict Detection
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">AI-detected beneficiary conflicts requiring human review</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200/80 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-medium text-gray-500">Pending Review</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-rose-500" />
            <span className="text-[11px] font-medium text-gray-500">Confirmed</span>
          </div>
          <p className="text-2xl font-bold text-rose-600">{confirmedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/80 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-[11px] font-medium text-gray-500">Total Detected</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{conflicts.length}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] bg-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* Conflicts List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading conflicts...
        </div>
      ) : conflicts.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No conflicts detected. All clear!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {conflicts.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden hover:shadow-md transition animate-fade-in">
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_COLORS[c.status] || ""}`}>
                        {c.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                        {TYPE_LABELS[c.conflict_type] || c.conflict_type}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        c.confidence >= 0.9 ? "bg-rose-100 text-rose-700" :
                        c.confidence >= 0.7 ? "bg-amber-100 text-amber-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {(c.confidence * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p className="text-xs text-gray-700">{c.explanation}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                      <span>App: {c.application_id?.slice(0, 8)}...</span>
                      {c.conflicting_application_id && <span>vs: {c.conflicting_application_id.slice(0, 8)}...</span>}
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {c.status === "PENDING_REVIEW" && (
                      <>
                        <button onClick={() => handleResolve(c.id, "CONFIRMED")} disabled={actioning === c.id}
                          className="px-2.5 py-1.5 text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition disabled:opacity-50">
                          Confirm
                        </button>
                        <button onClick={() => handleResolve(c.id, "FALSE_POSITIVE")} disabled={actioning === c.id}
                          className="px-2.5 py-1.5 text-[10px] font-semibold bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition disabled:opacity-50">
                          False Positive
                        </button>
                        <button onClick={() => handleResolve(c.id, "CLEARED")} disabled={actioning === c.id}
                          className="px-2.5 py-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50">
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded signals */}
              {expandedId === c.id && c.matching_signals && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase mb-2 mt-2">Matching Signals</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(c.matching_signals).map(([key, val]: [string, any]) => (
                      <div key={key} className="bg-gray-50 rounded-lg p-2 text-[11px]">
                        <span className="font-medium text-gray-600">{key.replace(/_/g, " ")}</span>
                        <p className={`font-bold ${val === true || (typeof val === "number" && val >= 0.85) ? "text-rose-600" : "text-gray-500"}`}>
                          {typeof val === "boolean" ? (val ? "✓ Match" : "✗ No match") : typeof val === "number" ? `${(val * 100).toFixed(0)}%` : String(val)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
