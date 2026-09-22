"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getApplication, getScheme, getPostSelectionSummary,
  createDisbursement, updateDisbursement, createRenewal, updateRenewal,
  type ApplicationRead, type SchemeRead, type PostSelectionSummary,
  type DisbursementRead, type RenewalRead, type DisbursementStatus, type RenewalStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft, Award, CreditCard, RefreshCw, Plus, Calendar,
  AlertCircle, CheckCircle2, Clock, Edit2, DollarSign, TrendingUp, X,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const cls = status === "DISBURSED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === "PENDING" ? "bg-amber-50 text-amber-700 border-amber-200" :
              status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              status === "REJECTED" ? "bg-rose-50 text-rose-700 border-rose-200" :
              status === "FAILED" ? "bg-rose-50 text-rose-700 border-rose-200" :
              "bg-blue-50 text-blue-700 border-blue-200";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium border ${cls}`}>{status}</span>;
}

export default function PostSelectionManagementPage() {
  const params = useParams();
  const applicationId = params?.id as string;
  const { user } = useAuth();
  const canMutate = user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: app, isLoading: appLoading } = useSWR<ApplicationRead>(
    applicationId ? `/api/applications/${applicationId}` : null, () => getApplication(applicationId)
  );
  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null, () => getScheme(app!.scheme_id)
  );
  const { data: summary, isLoading: summaryLoading } = useSWR<PostSelectionSummary>(
    applicationId ? `/api/applications/${applicationId}/post-selection-summary` : null, () => getPostSelectionSummary(applicationId)
  );

  const [showNewDisb, setShowNewDisb] = useState(false);
  const [disbAmount, setDisbAmount] = useState("");
  const [disbInstallment, setDisbInstallment] = useState("1");
  const [disbRemarks, setDisbRemarks] = useState("");
  const [updatingDisb, setUpdatingDisb] = useState<DisbursementRead | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DisbursementStatus>("DISBURSED");
  const [updateRemarks, setUpdateRemarks] = useState("");
  const [showNewRenewal, setShowNewRenewal] = useState(false);
  const [renewalCycle, setRenewalCycle] = useState("2026-27");
  const [renewalDueDate, setRenewalDueDate] = useState("");
  const [renewalRemarks, setRenewalRemarks] = useState("");
  const [updatingRenewal, setUpdatingRenewal] = useState<RenewalRead | null>(null);
  const [renewalStatusVal, setRenewalStatusVal] = useState<RenewalStatus>("APPROVED");
  const [renewalReviewRemarks, setRenewalReviewRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const totalDisbursed = React.useMemo(() => {
    if (!summary?.disbursements) return 0;
    return summary.disbursements.filter((d) => d.status === "DISBURSED").reduce((sum, d) => sum + Number(d.amount), 0);
  }, [summary]);
  const pendingCount = React.useMemo(() => {
    if (!summary?.disbursements) return 0;
    return summary.disbursements.filter((d) => d.status === "PENDING").length;
  }, [summary]);

  const handleCreateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setFormError(null);
    try {
      const amt = parseFloat(disbAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Enter a valid amount > 0");
      await createDisbursement(applicationId, { amount: amt, installment_number: parseInt(disbInstallment, 10) || 1, remarks: disbRemarks.trim() || undefined });
      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setShowNewDisb(false); setDisbAmount(""); setDisbRemarks("");
    } catch (err: any) { setFormError(err?.message || "Failed"); } finally { setIsSubmitting(false); }
  };

  const handleUpdateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault(); if (!updatingDisb) return; setIsSubmitting(true); setFormError(null);
    try {
      await updateDisbursement(updatingDisb.id, { status: updateStatus, remarks: updateRemarks.trim() || undefined });
      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setUpdatingDisb(null);
    } catch (err: any) { setFormError(err?.message || "Failed"); } finally { setIsSubmitting(false); }
  };

  const handleCreateRenewal = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setFormError(null);
    try {
      if (!renewalDueDate) throw new Error("Select a due date");
      await createRenewal(applicationId, { academic_year_or_cycle: renewalCycle.trim(), due_date: renewalDueDate, remarks: renewalRemarks.trim() || undefined });
      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setShowNewRenewal(false); setRenewalRemarks("");
    } catch (err: any) { setFormError(err?.message || "Failed"); } finally { setIsSubmitting(false); }
  };

  const handleUpdateRenewal = async (e: React.FormEvent) => {
    e.preventDefault(); if (!updatingRenewal) return; setIsSubmitting(true); setFormError(null);
    try {
      await updateRenewal(updatingRenewal.id, { status: renewalStatusVal, remarks: renewalReviewRemarks.trim() || undefined });
      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setUpdatingRenewal(null);
    } catch (err: any) { setFormError(err?.message || "Failed"); } finally { setIsSubmitting(false); }
  };

  if (appLoading || summaryLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  }
  if (!app) {
    return <div className="p-8 text-center text-gray-400">Application not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/applications/${applicationId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Application
        </Link>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 rounded-xl p-6 border border-emerald-200 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900">Post-Selection Management</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">{app.applicant_name} • {scheme?.name || "Scholarship"}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white rounded-lg p-3 border border-emerald-200 text-center">
              <div className="text-[10px] text-gray-400 font-medium">Total Disbursed</div>
              <div className="text-lg font-bold text-emerald-700">₹{totalDisbursed.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200 text-center">
              <div className="text-[10px] text-gray-400 font-medium">Pending</div>
              <div className="text-lg font-bold text-amber-600">{pendingCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Disbursements */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><CreditCard className="w-4 h-4 text-[#de5c36]" /> Disbursement Records</h3>
          {canMutate && (
            <button onClick={() => setShowNewDisb(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition">
              <Plus className="w-3.5 h-3.5" /> New Disbursement
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5">Installment</th><th className="px-4 py-2.5">Amount</th>
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Remarks</th>
                <th className="px-4 py-2.5">Date</th>{canMutate && <th className="px-4 py-2.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary?.disbursements && summary.disbursements.length > 0 ? (
                summary.disbursements.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-800">#{d.installment_number}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-800">₹{Number(d.amount).toLocaleString()}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={d.status} /></td>
                    <td className="px-4 py-2.5 text-gray-500 text-[11px] max-w-[200px] truncate">{d.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(d.created_at).toLocaleDateString()}</td>
                    {canMutate && (
                      <td className="px-4 py-2.5 text-right">
                        {d.status === "PENDING" && (
                          <button onClick={() => { setUpdatingDisb(d); setUpdateStatus("DISBURSED"); setUpdateRemarks(""); setFormError(null); }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200">
                            <Edit2 className="w-3 h-3 inline mr-1" />Update
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={canMutate ? 6 : 5} className="px-4 py-8 text-center text-gray-400">No disbursements recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Renewals */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-[#de5c36]" /> Renewal Records</h3>
          {canMutate && (
            <button onClick={() => setShowNewRenewal(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-[#105a8b] hover:bg-[#0d4b74] text-white rounded-lg shadow-sm transition">
              <Plus className="w-3.5 h-3.5" /> New Renewal
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-2.5">Cycle</th><th className="px-4 py-2.5">Due Date</th>
                <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Remarks</th>
                <th className="px-4 py-2.5">Created</th>{canMutate && <th className="px-4 py-2.5 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary?.renewals && summary.renewals.length > 0 ? (
                summary.renewals.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{r.academic_year_or_cycle}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-[11px]">{r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 text-gray-500 text-[11px] max-w-[200px] truncate">{r.remarks || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-[11px]">{new Date(r.created_at).toLocaleDateString()}</td>
                    {canMutate && (
                      <td className="px-4 py-2.5 text-right">
                        {r.status === "PENDING_REVIEW" && (
                          <button onClick={() => { setUpdatingRenewal(r); setRenewalStatusVal("APPROVED"); setRenewalReviewRemarks(""); setFormError(null); }}
                            className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-200">
                            <Edit2 className="w-3 h-3 inline mr-1" />Review
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr><td colSpan={canMutate ? 6 : 5} className="px-4 py-8 text-center text-gray-400">No renewal records yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Disbursement */}
      {showNewDisb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Record New Disbursement</h3><button onClick={() => setShowNewDisb(false)}><X className="w-4 h-4 text-gray-400" /></button></div>
          {formError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{formError}</div>}
          <form onSubmit={handleCreateDisbursement} className="space-y-3">
            <div><label className="text-[11px] text-gray-500 font-medium">Amount (₹)</label><input type="number" step="0.01" value={disbAmount} onChange={(e) => setDisbAmount(e.target.value)} required className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" /></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Installment #</label><input type="number" min="1" value={disbInstallment} onChange={(e) => setDisbInstallment(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" /></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Remarks</label><textarea value={disbRemarks} onChange={(e) => setDisbRemarks(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" /></div>
            <button type="submit" disabled={isSubmitting} className="w-full py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg transition disabled:opacity-50">{isSubmitting ? "Recording..." : "Record Disbursement"}</button>
          </form>
        </div></div>
      )}

      {/* Modal: Update Disbursement */}
      {updatingDisb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Update Disbursement #{updatingDisb.installment_number}</h3><button onClick={() => setUpdatingDisb(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
          {formError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{formError}</div>}
          <form onSubmit={handleUpdateDisbursement} className="space-y-3">
            <div><label className="text-[11px] text-gray-500 font-medium">New Status</label><select value={updateStatus} onChange={(e) => setUpdateStatus(e.target.value as DisbursementStatus)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]"><option value="DISBURSED">DISBURSED</option><option value="FAILED">FAILED</option></select></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Remarks</label><textarea value={updateRemarks} onChange={(e) => setUpdateRemarks(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" /></div>
            <button type="submit" disabled={isSubmitting} className="w-full py-2 text-xs font-semibold bg-[#105a8b] hover:bg-[#0d4b74] text-white rounded-lg transition disabled:opacity-50">{isSubmitting ? "Updating..." : "Update Status"}</button>
          </form>
        </div></div>
      )}

      {/* Modal: New Renewal */}
      {showNewRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Initiate Renewal Cycle</h3><button onClick={() => setShowNewRenewal(false)}><X className="w-4 h-4 text-gray-400" /></button></div>
          {formError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{formError}</div>}
          <form onSubmit={handleCreateRenewal} className="space-y-3">
            <div><label className="text-[11px] text-gray-500 font-medium">Academic Year / Cycle</label><input value={renewalCycle} onChange={(e) => setRenewalCycle(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" /></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Due Date</label><input type="date" value={renewalDueDate} onChange={(e) => setRenewalDueDate(e.target.value)} required className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]" /></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Remarks</label><textarea value={renewalRemarks} onChange={(e) => setRenewalRemarks(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" /></div>
            <button type="submit" disabled={isSubmitting} className="w-full py-2 text-xs font-semibold bg-[#105a8b] hover:bg-[#0d4b74] text-white rounded-lg transition disabled:opacity-50">{isSubmitting ? "Creating..." : "Initiate Renewal"}</button>
          </form>
        </div></div>
      )}

      {/* Modal: Update Renewal */}
      {updatingRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-900">Review Renewal: {updatingRenewal.academic_year_or_cycle}</h3><button onClick={() => setUpdatingRenewal(null)}><X className="w-4 h-4 text-gray-400" /></button></div>
          {formError && <div className="mb-3 p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">{formError}</div>}
          <form onSubmit={handleUpdateRenewal} className="space-y-3">
            <div><label className="text-[11px] text-gray-500 font-medium">Decision</label><select value={renewalStatusVal} onChange={(e) => setRenewalStatusVal(e.target.value as RenewalStatus)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]"><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option></select></div>
            <div><label className="text-[11px] text-gray-500 font-medium">Remarks</label><textarea value={renewalReviewRemarks} onChange={(e) => setRenewalReviewRemarks(e.target.value)} className="w-full mt-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-20" /></div>
            <button type="submit" disabled={isSubmitting} className="w-full py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition disabled:opacity-50">{isSubmitting ? "Updating..." : "Submit Decision"}</button>
          </form>
        </div></div>
      )}
    </div>
  );
}
