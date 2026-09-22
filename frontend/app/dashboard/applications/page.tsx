"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getApplications,
  getSchemes,
  type ApplicationRead,
  type SchemeRead,
} from "@/lib/api";
import {
  FileCheck2,
  Search,
  Filter,
  ArrowRight,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status.replace(/_/g, " ");

  if (s.includes("verified") || s.includes("approved") || s === "selected") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (s.includes("deficien") || s === "deficient") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (s.includes("scrutiny")) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (s === "rejected" || s === "ineligible") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${cls}`}>
      {label}
    </span>
  );
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationRead[]>([]);
  const [schemes, setSchemes] = useState<SchemeRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterScheme, setFilterScheme] = useState("");
  const [filterState, setFilterState] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [apps, sch] = await Promise.all([
          getApplications({ page_size: 50 }),
          getSchemes(),
        ]);
        setApplications(apps);
        setSchemes(sch);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = applications.filter((app) => {
    if (filterScheme && app.scheme_id !== filterScheme) return false;
    if (filterState && app.current_state !== filterState) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        app.applicant_name.toLowerCase().includes(q) ||
        app.applicant_email.toLowerCase().includes(q) ||
        app.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueStates = [...new Set(applications.map((a) => a.current_state))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#de5c36]" />
            Application Verification
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Review and verify scholarship &amp; fellowship applications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5 text-gray-600"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#de5c36] focus:bg-white transition"
              placeholder="Search by name, email, or application ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              className="pl-8 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-[#de5c36]"
              value={filterScheme}
              onChange={(e) => setFilterScheme(e.target.value)}
            >
              <option value="">All Schemes</option>
              {schemes.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              className="pl-3 pr-8 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg text-gray-700 appearance-none focus:outline-none focus:ring-1 focus:ring-[#de5c36]"
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
            >
              <option value="">All Statuses</option>
              {uniqueStates.map((st) => (
                <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-gray-400">
            No applications found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Application ID</th>
                  <th className="px-5 py-3">Applicant Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Submitted</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50/70 transition"
                  >
                    <td className="px-5 py-3 font-medium text-gray-800 text-[11px]">
                      {app.id.slice(0, 14).toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-gray-700 font-medium">
                      {app.applicant_name}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-[11px]">
                      {app.applicant_email}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={app.current_state} />
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200 transition"
                      >
                        View <ArrowRight className="w-3 h-3" />
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
