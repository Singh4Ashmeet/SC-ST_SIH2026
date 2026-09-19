"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  getApplication,
  getScheme,
  getDocuments,
  getAvailableTransitions,
  applyTransition,
  type ApplicationRead,
  type SchemeRead,
  type DocumentRead,
  type WorkflowTransition,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowLeft,
  UserCheck,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  FileCheck2,
  User,
  Mail,
  Phone,
  Calendar,
  Layers,
  Sparkles,
  Info,
  ExternalLink,
  ChevronRight,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SelectionReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params?.applicationId as string;
  const { user } = useAuth();

  const isAuthorized =
    user?.role === "SUPER_ADMIN" || user?.role === "SELECTION_COMMITTEE";

  const { data: app, isLoading: appLoading } = useSWR<ApplicationRead>(
    isAuthorized && applicationId ? `/api/applications/${applicationId}` : null,
    () => getApplication(applicationId)
  );

  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null,
    () => getScheme(app!.scheme_id)
  );

  const { data: documents, isLoading: docsLoading } = useSWR<DocumentRead[]>(
    applicationId ? `/api/applications/${applicationId}/documents` : null,
    () => getDocuments(applicationId)
  );

  const { data: availableTransitions } = useSWR<WorkflowTransition[]>(
    applicationId ? `/api/applications/${applicationId}/available-transitions` : null,
    () => getAvailableTransitions(applicationId)
  );

  // Modal dialog states for actions
  const [actionModal, setActionModal] = useState<"APPROVE" | "REJECT" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Derive trigger names dynamically from available transitions or scheme config
  const { approveTrigger, rejectTrigger } = React.useMemo(() => {
    let approve = "committee_approved";
    let reject = "committee_rejected";

    const transitions = availableTransitions || scheme?.config?.workflow_transitions || [];
    for (const t of transitions) {
      const trg = t.trigger.toLowerCase();
      const toSt = t.to_state.toLowerCase();
      if ((trg.includes("approv") || toSt.includes("approv") || toSt.includes("award")) && !toSt.includes("reject")) {
        approve = t.trigger;
      }
      if (trg.includes("reject") || toSt.includes("reject")) {
        reject = t.trigger;
      }
    }
    return { approveTrigger: approve, rejectTrigger: reject };
  }, [availableTransitions, scheme]);

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const trigger = decision === "APPROVE" ? approveTrigger : rejectTrigger;
      await applyTransition(applicationId, trigger, {
        decision,
        remarks: remarks.trim() || undefined,
        decided_by: user?.id,
      });

      await mutate(`/api/applications/${applicationId}`);
      await mutate(`/api/applications/${applicationId}/available-transitions`);
      await mutate("/api/applications");
      setActionModal(null);

      if (decision === "APPROVE") {
        router.push(`/dashboard/applications/${applicationId}/post-selection`);
      } else {
        router.push("/dashboard/selection");
      }
    } catch (err: any) {
      setActionError(err?.message || "Failed to record committee decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="bg-slate-900/80 border-slate-800 text-slate-100 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Committee evaluation dossiers are restricted to Selection Committee members and Super Admins.
          </p>
          <div className="pt-2">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (appLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <Skeleton className="h-28 w-full bg-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64 bg-slate-800" />
          <Skeleton className="h-64 lg:col-span-2 bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/selection">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Queue
          </Button>
        </Link>
        <Card className="bg-slate-900/70 border-slate-800 p-6 text-center text-slate-400">
          Application not found.
        </Card>
      </div>
    );
  }

  const isApproved = app.current_state === "approved";
  const isRejected = app.current_state === "rejected";
  const canDecide = !isApproved && !isRejected;

  return (
    <div className="space-y-6">
      {/* Back button & State Notice */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/selection">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Committee Queue
          </Button>
        </Link>

        {isApproved && (
          <Link href={`/dashboard/applications/${app.id}/post-selection`}>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
              <Award className="w-3.5 h-3.5 mr-1.5" /> Open Post-Selection Management
            </Button>
          </Link>
        )}
      </div>

      {/* Candidate Dossier Header */}
      <Card className="bg-slate-900/80 border-slate-800 text-slate-100 p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-indigo-950/60 border-indigo-800/40 text-indigo-400 font-mono text-xs">
                {scheme?.code || "SCHEME"}
              </Badge>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs">
                {app.current_state.toUpperCase()}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {app.applicant_name}
            </h1>
            <p className="text-xs text-slate-400">
              {scheme?.name || "Scholarship Program"} • Application ID: <span className="font-mono text-slate-300">{app.id}</span>
            </p>
          </div>

          {/* Action Buttons */}
          {canDecide ? (
            <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0">
              <Button
                id="reject-application-btn"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRemarks("");
                  setActionError(null);
                  setActionModal("REJECT");
                }}
                className="border-rose-800/50 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 text-xs h-9 px-3.5 font-medium"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-400" />
                Reject Candidate
              </Button>
              <Button
                id="approve-application-btn"
                size="sm"
                onClick={() => {
                  setRemarks("");
                  setActionError(null);
                  setActionModal("APPROVE");
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 px-4 font-semibold shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Approve Award
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isApproved && (
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs py-1 px-2.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Committee Approved
                </Badge>
              )}
              {isRejected && (
                <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs py-1 px-2.5">
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Committee Rejected
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Applicant Profile & Eligibility Results */}
        <div className="space-y-6 lg:col-span-1">
          {/* Candidate Profile */}
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                Candidate Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-semibold">Email</div>
                <div className="text-slate-200 font-mono mt-0.5">{app.applicant_email}</div>
              </div>
              {app.applicant_phone && (
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Phone</div>
                  <div className="text-slate-200 mt-0.5">{app.applicant_phone}</div>
                </div>
              )}
              <div>
                <div className="text-slate-500 text-[10px] uppercase font-semibold">Applied On</div>
                <div className="text-slate-200 mt-0.5">{new Date(app.created_at).toLocaleString()}</div>
              </div>
            </CardContent>
          </Card>

          {/* Eligibility Criteria & Applicant Data */}
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Evaluated Eligibility Data
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Self-declared and verified parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {Object.entries(app.applicant_data || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-slate-800/40 text-xs">
                  <span className="text-slate-400 capitalize font-medium">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-slate-200 font-semibold">
                    {typeof val === "boolean" ? (val ? "True" : "False") : String(val)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Verified Document Dossier with Extracted Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/70 border-slate-800">
            <CardHeader className="pb-3 border-b border-slate-800/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-purple-400" />
                    Verified Evidence & OCR Extractions
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Inspected and certified by Scrutiny Officers prior to committee review
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                  {documents?.length || 0} Documents
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {docsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full bg-slate-800" />
                ))
              ) : documents?.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No documents attached to this dossier.
                </div>
              ) : (
                documents?.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-xs text-slate-200 capitalize">
                          {doc.doc_type.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate max-w-sm">
                          {doc.storage_key}
                        </div>
                      </div>
                      <Badge
                        className={
                          doc.status === "VERIFIED"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]"
                            : doc.status === "DEFICIENT"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]"
                            : "bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]"
                        }
                      >
                        {doc.status}
                      </Badge>
                    </div>

                    {/* Extracted fields table/JSON */}
                    {doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0 ? (
                      <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1.5">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Certified OCR Extracted Fields:
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {Object.entries(doc.extracted_fields).map(([k, v]) => (
                            <div key={k} className="bg-slate-900/90 border border-slate-800 p-2 rounded-lg">
                              <div className="text-[10px] text-slate-400 truncate capitalize">
                                {k.replace(/_/g, " ")}
                              </div>
                              <div className="font-semibold text-slate-200 mt-0.5 truncate">
                                {String(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        No automated field extractions available for this document format.
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Decision Action Dialog */}
      <Dialog open={actionModal !== null} onOpenChange={(open) => !open && setActionModal(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              {actionModal === "APPROVE" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Approve Scholarship Award
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400" />
                  Reject Candidate Application
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {actionModal === "APPROVE"
                ? `Confirm formal scholarship grant for ${app.applicant_name}. This will transition the application to approved state and unlock post-selection disbursements.`
                : `Confirm formal rejection for ${app.applicant_name}. This will terminate the active evaluation workflow.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-slate-300">
              Committee Remarks {actionModal === "REJECT" ? "(Mandatory)" : "(Optional)"}
            </label>
            <Textarea
              id="committee-remarks-input"
              placeholder={
                actionModal === "APPROVE"
                  ? "e.g., Candidate recommended by unanimous selection committee decision."
                  : "e.g., Degree transcript not aligned with priority research disciplines."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="bg-slate-950/80 border-slate-800 text-xs text-slate-200 min-h-[90px]"
            />

            {actionError && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs">
                {actionError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActionModal(null)}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              id="confirm-committee-action-btn"
              size="sm"
              disabled={isSubmitting || (actionModal === "REJECT" && !remarks.trim())}
              onClick={() => handleDecision(actionModal!)}
              className={
                actionModal === "APPROVE"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                  : "bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
              }
            >
              {isSubmitting ? "Recording..." : actionModal === "APPROVE" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
