"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
  Cpu,
  UserCheck,
  Building2,
  Award,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-blue-50 text-blue-700 border-blue-200";
  let label = status.replace(/_/g, " ");

  if (s.includes("verified") || s.includes("approved") || s === "selected" || s === "disbursed" || s === "fellowship_awarded") {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = s === "disbursed" ? "Disbursed" : s.includes("awarded") || s === "approved" ? "Approved" : "Verified";
  } else if (s.includes("deficien") || s === "deficient") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Deficient";
  } else if (s.includes("scrutiny") || s === "resubmitted") {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    label = s === "resubmitted" ? "Resubmitted" : "Scrutiny";
  } else if (s.includes("institute")) {
    cls = "bg-indigo-50 text-indigo-700 border-indigo-200";
    label = "Institute Verification";
  } else if (s === "selection" || s === "committee_review") {
    cls = "bg-purple-50 text-purple-700 border-purple-200";
    label = "Selection Committee";
  } else if (s === "rejected" || s === "ineligible") {
    cls = "bg-rose-50 text-rose-700 border-rose-200";
    label = "Rejected";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${cls}`}>
      {label}
    </span>
  );
}

function RoleBadge({ role }: { role?: string | null }) {
  const r = (role || "").toUpperCase();
  let cls = "bg-stone-100 text-stone-700 border-stone-200";
  let display = role ? role.replace(/_/g, " ") : "Officer";

  if (r.includes("SCRUTINY")) {
    cls = "bg-amber-50 text-amber-800 border-amber-300 font-bold";
  } else if (r.includes("INSTITUTE")) {
    cls = "bg-indigo-50 text-indigo-800 border-indigo-300 font-bold";
  } else if (r.includes("SELECTION")) {
    cls = "bg-purple-50 text-purple-800 border-purple-300 font-bold";
  } else if (r.includes("SCHEME_ADMIN") || r.includes("ADMIN")) {
    cls = "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold";
    display = "Scheme Admin (Disbursal)";
  } else if (r.includes("SCHOLAR")) {
    cls = "bg-teal-50 text-teal-800 border-teal-300 font-bold";
    display = "Scholar Active";
  } else if (r.includes("APPLICANT")) {
    cls = "bg-rose-50 text-rose-800 border-rose-300 font-bold";
    display = "Applicant (Correction)";
  } else if (r.includes("CLOSED")) {
    cls = "bg-gray-100 text-gray-600 border-gray-300";
    display = "Closed";
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono border ${cls}`}>
      {display}
    </span>
  );
}

function ApplicationsTable() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentQueueParam = searchParams.get("queue") || "all";

  const [activeQueue, setActiveQueue] = useState<string>(currentQueueParam);
  const [applications, setApplications] = useState<ApplicationRead[]>([]);
  const [schemes, setSchemes] = useState<SchemeRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterScheme, setFilterScheme] = useState("");
  const [filterState, setFilterState] = useState("");

  useEffect(() => {
    setActiveQueue(currentQueueParam);
  }, [currentQueueParam]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apps, sch] = await Promise.all([
        getApplications({ page_size: 100 }),
        getSchemes(),
      ]);
      setApplications(apps);
      setSchemes(sch);
    } catch (e) {
      console.error("Failed to load applications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const queueFiltered = useMemo(() => {
    if (activeQueue === "scrutiny") {
      return applications.filter((a) =>
        ["submitted", "document_scrutiny", "deficient", "resubmitted", "eligibility_check"].includes(a.current_state.toLowerCase())
      );
    } else if (activeQueue === "institute") {
      return applications.filter((a) =>
        ["institute_verification", "pending_institute_verification", "scrutiny_completed"].includes(a.current_state.toLowerCase())
      );
    } else if (activeQueue === "selection") {
      return applications.filter((a) =>
        ["selection", "pending_selection", "committee_review", "merit_evaluated"].includes(a.current_state.toLowerCase())
      );
    } else if (activeQueue === "awarded") {
      return applications.filter((a) =>
        ["approved", "fellowship_awarded", "disbursed"].includes(a.current_state.toLowerCase())
      );
    }
    return applications;
  }, [applications, activeQueue]);

  const filtered = useMemo(() => {
    return queueFiltered.filter((app) => {
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
  }, [queueFiltered, filterScheme, filterState, search]);

  const queueCounts = useMemo(() => {
    return {
      all: applications.length,
      scrutiny: applications.filter((a) => ["submitted", "document_scrutiny", "deficient", "resubmitted", "eligibility_check"].includes(a.current_state.toLowerCase())).length,
      institute: applications.filter((a) => ["institute_verification", "pending_institute_verification", "scrutiny_completed"].includes(a.current_state.toLowerCase())).length,
      selection: applications.filter((a) => ["selection", "pending_selection", "committee_review", "merit_evaluated"].includes(a.current_state.toLowerCase())).length,
      awarded: applications.filter((a) => ["approved", "fellowship_awarded", "disbursed"].includes(a.current_state.toLowerCase())).length,
    };
  }, [applications]);

  const uniqueStates = [...new Set(applications.map((a) => a.current_state))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#de5c36]" />
            Application Lifecycle &amp; Work Queues
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time pipeline monitoring, automated rule clearance, and role-based officer actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5 text-gray-700 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Live Data
          </button>
        </div>
      </div>

      {/* Queue Filter Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All Applications", count: queueCounts.all, icon: FileCheck2 },
          { key: "scrutiny", label: "Scrutiny Queue", count: queueCounts.scrutiny, icon: Cpu },
          { key: "institute", label: "Institute Queue", count: queueCounts.institute, icon: Building2 },
          { key: "selection", label: "Selection Committee", count: queueCounts.selection, icon: Award },
          { key: "awarded", label: "Awarded & Disbursed", count: queueCounts.awarded, icon: CheckCircle2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeQueue === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveQueue(tab.key);
                router.push(tab.key === "all" ? "/dashboard/applications" : `/dashboard/applications?queue=${tab.key}`);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-bold transition border-b-2 whitespace-nowrap ${
                isActive
                  ? "border-[#de5c36] text-[#de5c36] bg-white shadow-sm"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100/60"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? "bg-[#de5c36]/10 text-[#de5c36]" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Role Context Instructions Banner */}
      {activeQueue === "institute" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <div>
              <strong>Institutional Verification Queue:</strong> Verify student bonafide enrollment, admission offer letters, and institutional joining records. Click &quot;View&quot; on any case to validate.
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
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
          <div className="flex flex-col items-center justify-center h-48 text-sm text-gray-400 space-y-1">
            <p>No applications match the selected queue &amp; filters.</p>
            {activeQueue !== "all" && (
              <button
                onClick={() => {
                  setActiveQueue("all");
                  router.push("/dashboard/applications");
                }}
                className="text-xs text-[#de5c36] underline hover:text-[#c44a26]"
              >
                Clear queue filter to view all applications
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3">Application ID</th>
                  <th className="px-5 py-3">Applicant Name</th>
                  <th className="px-5 py-3">Email Address</th>
                  <th className="px-5 py-3">Lifecycle State</th>
                  <th className="px-5 py-3">Responsible Role</th>
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
                    <td className="px-5 py-3 font-medium text-gray-800 text-[11px] font-mono">
                      {app.id.slice(0, 14).toUpperCase()}
                    </td>
                    <td className="px-5 py-3 text-gray-900 font-bold">
                      {app.applicant_name}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-[11px]">
                      {app.applicant_email}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={app.current_state} />
                    </td>
                    <td className="px-5 py-3">
                      <RoleBadge role={app.current_responsible_role} />
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-[11px]">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold bg-gray-50 hover:bg-gray-100 text-gray-800 rounded border border-gray-200 transition shadow-xs"
                      >
                        View Case <ArrowRight className="w-3 h-3" />
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

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-400">Loading applications portal...</div>}>
      <ApplicationsTable />
    </Suspense>
  );
}
