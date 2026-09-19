"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getApplication,
  getScheme,
  getPostSelectionSummary,
  createDisbursement,
  updateDisbursement,
  createRenewal,
  updateRenewal,
  type ApplicationRead,
  type SchemeRead,
  type PostSelectionSummary,
  type DisbursementRead,
  type RenewalRead,
  type DisbursementStatus,
  type RenewalStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  Award,
  CreditCard,
  RefreshCw,
  Plus,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Edit2,
  DollarSign,
  TrendingUp,
  FileCheck2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PostSelectionManagementPage() {
  const params = useParams();
  const applicationId = params?.id as string;
  const { user } = useAuth();

  const canMutate =
    user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: app, isLoading: appLoading } = useSWR<ApplicationRead>(
    applicationId ? `/api/applications/${applicationId}` : null,
    () => getApplication(applicationId)
  );

  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null,
    () => getScheme(app!.scheme_id)
  );

  const { data: summary, isLoading: summaryLoading } = useSWR<PostSelectionSummary>(
    applicationId ? `/api/applications/${applicationId}/post-selection-summary` : null,
    () => getPostSelectionSummary(applicationId)
  );

  // Dialog state: New Disbursement
  const [showNewDisbursement, setShowNewDisbursement] = useState(false);
  const [disbAmount, setDisbAmount] = useState("");
  const [disbInstallment, setDisbInstallment] = useState("1");
  const [disbRemarks, setDisbRemarks] = useState("");

  // Dialog state: Update Disbursement Status
  const [updatingDisbursement, setUpdatingDisbursement] = useState<DisbursementRead | null>(null);
  const [updateStatus, setUpdateStatus] = useState<DisbursementStatus>("DISBURSED");
  const [updateRemarks, setUpdateRemarks] = useState("");

  // Dialog state: New Renewal
  const [showNewRenewal, setShowNewRenewal] = useState(false);
  const [renewalCycle, setRenewalCycle] = useState("2026-27");
  const [renewalDueDate, setRenewalDueDate] = useState("");
  const [renewalRemarks, setRenewalRemarks] = useState("");

  // Dialog state: Update Renewal Status
  const [updatingRenewal, setUpdatingRenewal] = useState<RenewalRead | null>(null);
  const [renewalStatusVal, setRenewalStatusVal] = useState<RenewalStatus>("APPROVED");
  const [renewalReviewRemarks, setRenewalReviewRemarks] = useState("");

  // Processing & Error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Derived totals
  const totalDisbursed = React.useMemo(() => {
    if (!summary?.disbursements) return 0;
    return summary.disbursements
      .filter((d) => d.status === "DISBURSED")
      .reduce((sum, d) => sum + Number(d.amount), 0);
  }, [summary]);

  const pendingDisbursementsCount = React.useMemo(() => {
    if (!summary?.disbursements) return 0;
    return summary.disbursements.filter((d) => d.status === "PENDING").length;
  }, [summary]);

  const handleCreateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const amt = parseFloat(disbAmount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Please enter a valid disbursement amount greater than 0");
      }
      await createDisbursement(applicationId, {
        amount: amt,
        installment_number: parseInt(disbInstallment, 10) || 1,
        remarks: disbRemarks.trim() || undefined,
      });

      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setShowNewDisbursement(false);
      setDisbAmount("");
      setDisbRemarks("");
    } catch (err: any) {
      setFormError(err?.message || "Failed to record disbursement installment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDisbursement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingDisbursement) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await updateDisbursement(updatingDisbursement.id, {
        status: updateStatus,
        remarks: updateRemarks.trim() || undefined,
      });

      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setUpdatingDisbursement(null);
    } catch (err: any) {
      setFormError(err?.message || "Failed to update disbursement status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (!renewalDueDate) {
        throw new Error("Please select a due date for the renewal cycle");
      }
      await createRenewal(applicationId, {
        academic_year_or_cycle: renewalCycle.trim(),
        due_date: renewalDueDate,
        remarks: renewalRemarks.trim() || undefined,
      });

      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setShowNewRenewal(false);
      setRenewalRemarks("");
    } catch (err: any) {
      setFormError(err?.message || "Failed to initiate renewal cycle");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRenewal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingRenewal) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await updateRenewal(updatingRenewal.id, {
        status: renewalStatusVal,
        remarks: renewalReviewRemarks.trim() || undefined,
      });

      await mutate(`/api/applications/${applicationId}/post-selection-summary`);
      setUpdatingRenewal(null);
    } catch (err: any) {
      setFormError(err?.message || "Failed to update renewal status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDisbursementBadge = (status: DisbursementStatus) => {
    switch (status) {
      case "DISBURSED":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Disbursed</Badge>;
      case "PENDING":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Pending</Badge>;
      case "ON_HOLD":
        return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-[10px]">On Hold</Badge>;
      case "FAILED":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const getRenewalBadge = (status: RenewalStatus) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">Approved</Badge>;
      case "PENDING_REVIEW":
        return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Pending Review</Badge>;
      case "REJECTED":
        return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">Rejected</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  if (appLoading || summaryLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-44 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/applications">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Applications
          </Button>
        </Link>
        <Card className="bg-slate-900/70 border-slate-800 p-6 text-center text-slate-400">
          Application not found.
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Back button & Page Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link href={`/dashboard/applications/${app.id}`}>
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Application #{app.id.slice(0, 8)}
          </Button>
        </Link>

        {!canMutate && (
          <Badge variant="outline" className="bg-slate-900 border-slate-800 text-slate-400 text-xs">
            Viewing Mode (Read-Only)
          </Badge>
        )}
      </div>

      {/* Main Header Banner */}
      <Card className="bg-slate-900/80 border-slate-800 text-slate-100 p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                Awarded Candidate
              </Badge>
              <Badge variant="outline" className="bg-indigo-950/60 border-indigo-800/40 text-indigo-400 font-mono text-xs">
                {scheme?.code || "SCHEME"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
              Post-Selection Management: {app.applicant_name}
            </h1>
            <p className="text-xs text-slate-400">
              Structured tracking of grant installment disbursements and periodic fellowship renewal cycles.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 p-3 rounded-xl shrink-0">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Disbursed</div>
              <div className="text-base font-bold text-emerald-400 font-mono">
                ₹{totalDisbursed.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Pending Installments</div>
              <div className="text-base font-bold text-amber-400 font-mono">
                {pendingDisbursementsCount}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 1: Disbursements */}
      <Card className="bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-400" />
              Disbursement Installments
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Direct benefit transfers and installment payment schedule
            </CardDescription>
          </div>

          {canMutate && (
            <Button
              id="record-disbursement-btn"
              size="sm"
              onClick={() => {
                setDisbAmount("");
                setDisbInstallment(String((summary?.disbursements?.length || 0) + 1));
                setDisbRemarks("");
                setFormError(null);
                setShowNewDisbursement(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 font-semibold shadow-sm shadow-emerald-600/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record New Disbursement
            </Button>
          )}
        </CardHeader>

        <CardContent className="pt-4 p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-400 text-xs">Installment</TableHead>
                <TableHead className="text-slate-400 text-xs">Amount</TableHead>
                <TableHead className="text-slate-400 text-xs">Status</TableHead>
                <TableHead className="text-slate-400 text-xs">Disbursed Date</TableHead>
                <TableHead className="text-slate-400 text-xs">Remarks</TableHead>
                {canMutate && (
                  <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.disbursements?.length === 0 ? (
                <TableRow className="border-slate-800/60">
                  <TableCell colSpan={canMutate ? 6 : 5} className="py-8 text-center text-slate-500 text-xs">
                    No disbursement records logged for this candidate yet.
                  </TableCell>
                </TableRow>
              ) : (
                summary?.disbursements?.map((d) => (
                  <TableRow key={d.id} className="border-slate-800/60 hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-xs text-slate-200">
                      Installment #{d.installment_number}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-xs text-emerald-400">
                      ₹{Number(d.amount).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>{getDisbursementBadge(d.status)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {d.disbursed_date ? new Date(d.disbursed_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-slate-300 text-xs max-w-xs truncate">
                      {d.remarks || "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUpdatingDisbursement(d);
                            setUpdateStatus(d.status);
                            setUpdateRemarks(d.remarks || "");
                            setFormError(null);
                          }}
                          className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 h-7 px-2.5"
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Update Status
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 2: Renewals */}
      <Card className="bg-slate-900/70 border-slate-800">
        <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-purple-400" />
              Annual Renewal Cycles
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Academic progress reports, GPA verification, and fellowship renewal cycles
            </CardDescription>
          </div>

          {canMutate && (
            <Button
              id="start-renewal-btn"
              size="sm"
              onClick={() => {
                setRenewalCycle("2026-27");
                setRenewalDueDate("");
                setRenewalRemarks("");
                setFormError(null);
                setShowNewRenewal(true);
              }}
              className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8 font-semibold shadow-sm shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Start Renewal Cycle
            </Button>
          )}
        </CardHeader>

        <CardContent className="pt-4 p-0 overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-950/40 border-b border-slate-800">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-400 text-xs">Academic Cycle</TableHead>
                <TableHead className="text-slate-400 text-xs">Status</TableHead>
                <TableHead className="text-slate-400 text-xs">Due Date</TableHead>
                <TableHead className="text-slate-400 text-xs">Reviewed Date</TableHead>
                <TableHead className="text-slate-400 text-xs">Remarks</TableHead>
                {canMutate && (
                  <TableHead className="text-slate-400 text-xs text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.renewals?.length === 0 ? (
                <TableRow className="border-slate-800/60">
                  <TableCell colSpan={canMutate ? 6 : 5} className="py-8 text-center text-slate-500 text-xs">
                    No renewal review cycles initiated yet.
                  </TableCell>
                </TableRow>
              ) : (
                summary?.renewals?.map((r) => (
                  <TableRow key={r.id} className="border-slate-800/60 hover:bg-slate-800/40">
                    <TableCell className="font-semibold text-xs text-slate-200 font-mono">
                      {r.academic_year_or_cycle}
                    </TableCell>
                    <TableCell>{getRenewalBadge(r.status)}</TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {new Date(r.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-slate-400 text-xs">
                      {r.reviewed_date ? new Date(r.reviewed_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-slate-300 text-xs max-w-xs truncate">
                      {r.remarks || "—"}
                    </TableCell>
                    {canMutate && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUpdatingRenewal(r);
                            setRenewalStatusVal(r.status === "PENDING_REVIEW" ? "APPROVED" : r.status);
                            setRenewalReviewRemarks(r.remarks || "");
                            setFormError(null);
                          }}
                          className="text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-950/40 h-7 px-2.5"
                        >
                          <FileCheck2 className="w-3 h-3 mr-1" />
                          Review / Update
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL 1: Record New Disbursement */}
      <Dialog open={showNewDisbursement} onOpenChange={setShowNewDisbursement}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleCreateDisbursement}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Record New Disbursement
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Log a scheduled or sanctioned installment for {app.applicant_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Amount (INR) *</label>
                <Input
                  id="disbursement-amount-input"
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 50000"
                  value={disbAmount}
                  onChange={(e) => setDisbAmount(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Installment Number *</label>
                <Input
                  id="disbursement-installment-input"
                  type="number"
                  min="1"
                  required
                  value={disbInstallment}
                  onChange={(e) => setDisbInstallment(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Remarks (Optional)</label>
                <Textarea
                  id="disbursement-remarks-input"
                  placeholder="e.g., Tranche 1 living allowance & research contingency"
                  value={disbRemarks}
                  onChange={(e) => setDisbRemarks(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1 min-h-[70px]"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewDisbursement(false)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                id="submit-disbursement-btn"
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
              >
                {isSubmitting ? "Recording..." : "Record Disbursement"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Update Disbursement Status */}
      <Dialog open={updatingDisbursement !== null} onOpenChange={(open) => !open && setUpdatingDisbursement(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleUpdateDisbursement}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-indigo-400" />
                Update Installment #{updatingDisbursement?.installment_number}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Amount: ₹{Number(updatingDisbursement?.amount || 0).toLocaleString("en-IN")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-medium text-slate-300">New Payment Status *</label>
                <select
                  id="update-disbursement-status-select"
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as DisbursementStatus)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md p-2 mt-1 focus:outline-none focus:border-indigo-500"
                >
                  <option value="DISBURSED">DISBURSED (Transferred via PFMS/Bank)</option>
                  <option value="PENDING">PENDING (Scheduled)</option>
                  <option value="ON_HOLD">ON_HOLD (Awaiting Compliance)</option>
                  <option value="FAILED">FAILED (Transaction Error)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Remarks / Transaction Reference</label>
                <Textarea
                  id="update-disbursement-remarks-input"
                  placeholder="e.g., PFMS UTR ref #9832104921 transferred successfully"
                  value={updateRemarks}
                  onChange={(e) => setUpdateRemarks(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1 min-h-[70px]"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUpdatingDisbursement(null)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                id="save-disbursement-status-btn"
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {isSubmitting ? "Saving..." : "Save Status"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Start Renewal Cycle */}
      <Dialog open={showNewRenewal} onOpenChange={setShowNewRenewal}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleCreateRenewal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-purple-400" />
                Start Fellowship Renewal Cycle
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Initiate annual progress evaluation for {app.applicant_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Academic Year / Cycle *</label>
                <Input
                  id="renewal-cycle-input"
                  required
                  placeholder="e.g. 2026-27"
                  value={renewalCycle}
                  onChange={(e) => setRenewalCycle(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Due Date *</label>
                <Input
                  id="renewal-duedate-input"
                  type="date"
                  required
                  value={renewalDueDate}
                  onChange={(e) => setRenewalDueDate(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Remarks (Optional)</label>
                <Textarea
                  id="renewal-remarks-input"
                  placeholder="e.g., Annual research supervisor progress certificate required."
                  value={renewalRemarks}
                  onChange={(e) => setRenewalRemarks(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1 min-h-[70px]"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewRenewal(false)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                id="submit-renewal-btn"
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                {isSubmitting ? "Starting..." : "Start Renewal"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Review Renewal */}
      <Dialog open={updatingRenewal !== null} onOpenChange={(open) => !open && setUpdatingRenewal(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <form onSubmit={handleUpdateRenewal}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-purple-400" />
                Review Renewal Cycle ({updatingRenewal?.academic_year_or_cycle})
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Determine extension approval or rejection based on scholar performance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div>
                <label className="text-xs font-medium text-slate-300">Decision *</label>
                <select
                  id="update-renewal-status-select"
                  value={renewalStatusVal}
                  onChange={(e) => setRenewalStatusVal(e.target.value as RenewalStatus)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-md p-2 mt-1 focus:outline-none focus:border-purple-500"
                >
                  <option value="APPROVED">APPROVED (Extend fellowship support)</option>
                  <option value="REJECTED">REJECTED (Discontinue grant)</option>
                  <option value="PENDING_REVIEW">PENDING REVIEW</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300">Review Remarks</label>
                <Textarea
                  id="update-renewal-remarks-input"
                  placeholder="e.g., Verified supervisor progress report and university transcripts."
                  value={renewalReviewRemarks}
                  onChange={(e) => setRenewalReviewRemarks(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-xs text-slate-200 mt-1 min-h-[70px]"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                  {formError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setUpdatingRenewal(null)}
                className="text-slate-400 text-xs"
              >
                Cancel
              </Button>
              <Button
                id="save-renewal-status-btn"
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                {isSubmitting ? "Saving..." : "Save Review"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
