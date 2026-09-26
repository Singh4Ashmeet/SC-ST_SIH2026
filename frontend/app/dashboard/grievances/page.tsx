"use client";

import React, { useEffect, useState } from "react";
import { getGrievances, updateGrievance, getGrievanceStats } from "@/lib/api";
import {
  MessageSquareWarning,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ArrowUpRight,
  Filter,
  Loader2,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  ASSIGNED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-200",
  AWAITING_APPLICANT: "bg-orange-50 text-orange-700 border-orange-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CLOSED: "bg-gray-50 text-gray-500 border-gray-200",
  ESCALATED: "bg-rose-50 text-rose-700 border-rose-200",
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  NORMAL: "bg-blue-100 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800",
  CRITICAL: "bg-rose-100 text-rose-700",
};

export default function GrievancesPage() {
  const [grievances, setGrievances] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        getGrievances({ status_filter: statusFilter || undefined }),
        getGrievanceStats(),
      ]);
      setGrievances((gRes as any)?.items || []);
      setStats(sRes);
    } catch (err) {
      console.error("Failed to load grievances:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActioning(id);
    try {
      await updateGrievance(id, { status: newStatus });
      await fetchData();
    } catch (err) {
      alert("Failed to update grievance");
    } finally {
      setActioning(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-[#de5c36]" />
            Grievance Management
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">SLA-tracked grievance handling with escalation</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, icon: MessageSquareWarning, color: "text-gray-700", bg: "bg-gray-50" },
            { label: "Open", value: stats.open, icon: Clock, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "SLA Breached", value: stats.breached, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" },
            { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((card) => (
            <div key={card.label} className={`${card.bg} rounded-xl p-4 border border-gray-100`}>
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-[11px] font-medium text-gray-500">{card.label}</span>
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-gray-400" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] bg-white">
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      {/* Grievances List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading grievances...
        </div>
      ) : grievances.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No grievances found.</div>
      ) : (
        <div className="space-y-2">
          {grievances.map((g: any) => (
            <div key={g.id} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md transition animate-fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${STATUS_COLORS[g.status] || ""}`}>
                      {g.status.replace(/_/g, " ")}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${PRIORITY_COLORS[g.priority] || ""}`}>
                      {g.priority}
                    </span>
                    {g.is_breached && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 rounded border border-rose-200 flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> SLA BREACHED
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">{g.category}</span>
                  </div>
                  <p className="text-xs text-gray-800 font-medium">{g.description}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                    <span>By: {g.applicant_name}</span>
                    <span>{g.applicant_email}</span>
                    <span>SLA: {g.sla_hours}h</span>
                    {g.due_at && <span>Due: {new Date(g.due_at).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {g.status === "OPEN" && (
                    <button onClick={() => handleStatusUpdate(g.id, "ASSIGNED")} disabled={actioning === g.id}
                      className="px-2.5 py-1.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition disabled:opacity-50">
                      {actioning === g.id ? "..." : "Assign to Me"}
                    </button>
                  )}
                  {(g.status === "ASSIGNED" || g.status === "IN_PROGRESS") && (
                    <button onClick={() => handleStatusUpdate(g.id, "RESOLVED")} disabled={actioning === g.id}
                      className="px-2.5 py-1.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition disabled:opacity-50">
                      {actioning === g.id ? "..." : "Mark Resolved"}
                    </button>
                  )}
                  {g.status !== "ESCALATED" && g.status !== "RESOLVED" && g.status !== "CLOSED" && (
                    <button onClick={() => handleStatusUpdate(g.id, "ESCALATED")} disabled={actioning === g.id}
                      className="px-2.5 py-1.5 text-[10px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition disabled:opacity-50">
                      {actioning === g.id ? "..." : "Escalate"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
