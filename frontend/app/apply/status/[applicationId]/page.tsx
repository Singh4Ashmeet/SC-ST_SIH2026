"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  getApplication,
  getScheme,
  getDocuments,
  getDeficiencySummary,
  resubmitDocument,
  runEligibilityCheck,
  type ApplicationRead,
  type SchemeRead,
  type DocumentRead,
  type DeficiencySummary,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Upload,
  FileText,
  Clock,
  Shield,
  Info,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const STATE_MESSAGES: Record<string, { label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
  submitted: {
    label: "Application Submitted",
    description: "Your application has been received and is queued for automated eligibility evaluation.",
    icon: FileText,
  },
  eligibility_check: {
    label: "Eligibility Check in Progress",
    description: "Our system is verifying your eligibility against the scheme criteria.",
    icon: Shield,
  },
  document_scrutiny: {
    label: "Documents Under Review",
    description: "A scrutiny officer is reviewing your uploaded documents for authenticity and completeness.",
    icon: FileText,
  },
  deficient: {
    label: "Action Required: Documents Need Correction",
    description: "Some documents have been flagged as deficient. Please review the issues below and re-upload corrected versions.",
    icon: AlertCircle,
  },
  selection: {
    label: "Selection Committee Review",
    description: "Your application is being evaluated by the selection committee for final scoring.",
    icon: Shield,
  },
  approved: {
    label: "Application Approved",
    description: "Congratulations! Your application has been approved. Further instructions will follow.",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Application Rejected",
    description: "Your application did not meet the eligibility criteria or was rejected by the committee.",
    icon: XCircle,
  },
  disbursed: {
    label: "Funds Disbursed",
    description: "The scholarship amount has been disbursed to your account.",
    icon: CheckCircle2,
  },
  visa_issued: {
    label: "Visa & Travel Finalized",
    description: "Your visa has been issued and travel arrangements are being finalized.",
    icon: Shield,
  },
};

export default function ApplicationStatusPage() {
  const params = useParams();
  const applicationId = params?.applicationId as string;
  const router = useRouter();

  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitDocType, setResubmitDocType] = useState<string | null>(null);
  const [resubmitFile, setResubmitFile] = useState<File | null>(null);
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [showDeficiencyDetails, setShowDeficiencyDetails] = useState(false);

  const { data: application, isLoading: appLoading, mutate: mutateApp } = useSWR<ApplicationRead>(
    applicationId ? `/api/applications/${applicationId}` : null,
    () => getApplication(applicationId!)
  );

  const { data: scheme, isLoading: schemeLoading } = useSWR<SchemeRead>(
    application?.scheme_id ? `/api/schemes/${application.scheme_id}` : null,
    () => getScheme(application!.scheme_id)
  );

  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    applicationId ? `/api/applications/${applicationId}/documents` : null,
    () => getDocuments(applicationId!)
  );

  const { data: deficiencySummary } = useSWR<DeficiencySummary>(
    application?.current_state === "deficient" && applicationId
      ? `/api/applications/${applicationId}/deficiency-summary`
      : null,
    () => getDeficiencySummary(applicationId!)
  );

  const currentState = application?.current_state || "submitted";
  const stateInfo = STATE_MESSAGES[currentState] || {
    label: currentState.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    description: "Your application is being processed.",
    icon: Info,
  };

  const workflowStates = scheme?.config?.workflow_states ?? [
    { name: "submitted", label: "Submitted", is_terminal: false },
    { name: "eligibility_check", label: "Eligibility Check", is_terminal: false },
    { name: "document_scrutiny", label: "Document Scrutiny", is_terminal: false },
    { name: "deficient", label: "Document Correction Required", is_terminal: false },
    { name: "selection", label: "Selection Review", is_terminal: false },
    { name: "approved", label: "Approved", is_terminal: true },
    { name: "rejected", label: "Rejected", is_terminal: true },
  ];

  const currentStateIndex = workflowStates.findIndex((s) => s.name === currentState);

  const handleResubmit = async () => {
    if (!resubmitDocType || !resubmitFile) return;

    setIsResubmitting(true);
    setResubmitError(null);

    try {
      // Find the document ID for this doc_type
      const doc = documents?.find((d) => d.doc_type === resubmitDocType);
      if (!doc) throw new Error("Document not found");

      await resubmitDocument(applicationId, doc.id, resubmitFile);

      // Refresh data
      await mutateApp();
      await mutateDocs();

      setResubmitDialogOpen(false);
      setResubmitDocType(null);
      setResubmitFile(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Resubmission failed";
      setResubmitError(message);
    } finally {
      setIsResubmitting(false);
    }
  };

  const handleRunEligibilityCheck = async () => {
    try {
      await runEligibilityCheck(applicationId);
      await mutateApp();
      await mutateDocs();
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to run eligibility check");
    }
  };

  const loading = appLoading || schemeLoading || docsLoading;

  if (loading) {
    return <StatusPageSkeleton />;
  }

  if (!application || !scheme) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Application Not Found</h2>
        <p className="text-slate-600 mb-6">The requested application could not be loaded.</p>
        <Link href="/apply">
          <Button variant="outline">Back to Schemes</Button>
        </Link>
      </div>
    );
  }

  const StateIcon = stateInfo.icon;
  const requiredDocs = scheme.config?.required_documents ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/apply" className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Schemes
        </Link>
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-3 py-1">
          {scheme.code}
        </Badge>
      </div>

      {/* Status Header Card */}
      <Card className="border-slate-200 bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <StateIcon className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{stateInfo.label}</h1>
                  <p className="text-indigo-100 text-sm mt-1">{stateInfo.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-indigo-100">
                <span className="flex items-center gap-1">
                  <Badge className="bg-white/20 text-white border-white/30 text-xs px-2 py-0.5">
                    {scheme.code}
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  Application ID: <span className="font-mono">{application.id.slice(0, 8)}...</span>
                </span>
                <span className="flex items-center gap-1">
                  Submitted: {new Date(application.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Visual Timeline */}
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            Application Progress
          </CardTitle>
          <CardDescription>Track your application through each stage of the process</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

            {workflowStates.map((state, index) => {
              const isPast = currentStateIndex > -1 && index < currentStateIndex;
              const isCurrent = state.name === currentState;
              const isDeficientCurrent = currentState === "deficient" && state.name === "document_scrutiny";

              return (
                <div key={state.name} className="relative pl-14 pb-8 last:pb-0">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 border-4 transition-all",
                        isCurrent
                          ? "bg-indigo-600 text-white border-indigo-200 shadow-lg shadow-indigo-600/25"
                          : isDeficientCurrent
                          ? "bg-rose-600 text-white border-rose-200 shadow-lg shadow-rose-600/25"
                          : isPast
                          ? "bg-emerald-600 text-white border-emerald-200"
                          : "bg-white text-slate-400 border-slate-200"
                      )}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-6 h-6" />
                      ) : isDeficientCurrent ? (
                        <AlertCircle className="w-6 h-6" />
                      ) : (
                        <span className="text-sm font-bold">{index + 1}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                      <div className={cn("font-medium text-sm", isCurrent || isDeficientCurrent ? "text-slate-900" : isPast ? "text-slate-700" : "text-slate-500")}>
                        {state.label}
                      </div>
                      {isCurrent && (
                        <p className="text-xs text-indigo-600 mt-0.5 font-medium">Current Stage</p>
                      )}
                      {isDeficientCurrent && (
                        <p className="text-xs text-rose-600 mt-0.5 font-medium">Action Required</p>
                      )}
                      {isPast && (
                        <p className="text-xs text-emerald-600 mt-0.5">Completed</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Deficiency Details */}
      {currentState === "deficient" && deficiencySummary && (
        <Card className="border-rose-200 bg-rose-50">
          <CardHeader className="bg-rose-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <CardTitle className="text-lg text-rose-800">Documents Requiring Attention</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeficiencyDetails(!showDeficiencyDetails)}
                className="h-8 text-xs"
              >
                {showDeficiencyDetails ? "Hide Details" : "Show Details"}
                <ChevronRight className={cn("w-3.5 h-3.5 ml-1", showDeficiencyDetails && "rotate-90")} />
              </Button>
            </div>
            <CardDescription className="text-rose-700">
              The following documents have been flagged during scrutiny. Please review the issues and re-upload corrected versions.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {showDeficiencyDetails && (
              <div className="space-y-4">
                {Object.entries(deficiencySummary.documents).map(([docType, docInfo]) => {
                  const deficiencyReasons = docInfo.deficiency_reasons || [];
                  if (deficiencyReasons.length === 0) return null;

                  const docConfig = requiredDocs.find((d) => d.doc_type === docType);
                  const existingDoc = documents?.find((d) => d.doc_type === docType);

                  return (
                    <div key={docType} className="bg-white border border-rose-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-rose-600" />
                          <span className="font-medium text-slate-900">{docConfig?.label || docType}</span>
                        </div>
                        {existingDoc && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setResubmitDocType(docType);
                              setResubmitDialogOpen(true);
                            }}
                            className="h-8 text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Re-upload
                          </Button>
                        )}
                      </div>
                      <ul className="space-y-2 ml-7">
                        {deficiencyReasons.map((reason, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-rose-700">
                            <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
                            <span>{reason.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents Status */}
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Document Status
          </CardTitle>
          <CardDescription>Status of all required documents for this application</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {requiredDocs.map((doc) => {
              const docStatus = documents?.find((d) => d.doc_type === doc.doc_type);
              const isDeficient = docStatus?.status === "DEFICIENT";

              return (
                <div
                  key={doc.doc_type}
                  className={cn(
                    "p-4 rounded-lg border flex items-center justify-between gap-4",
                    isDeficient ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-white border flex items-center justify-center flex-shrink-0">
                      {docStatus?.status === "VERIFIED" && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                      {docStatus?.status === "PENDING" && <Clock className="w-5 h-5 text-amber-600" />}
                      {docStatus?.status === "DEFICIENT" && <AlertCircle className="w-5 h-5 text-rose-600" />}
                      {!docStatus && <FileText className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900 truncate">{doc.label}</h4>
                        {doc.required && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {docStatus
                          ? `Status: ${docStatus.status}${docStatus.deficiency_reasons?.length ? ` • ${docStatus.deficiency_reasons.length} issue(s)` : ""}`
                          : "Not uploaded yet"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {docStatus && (
                      <>
                        {docStatus.status === "VERIFIED" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Verified</Badge>
                        )}
                        {docStatus.status === "PENDING" && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>
                        )}
                        {docStatus.status === "DEFICIENT" && (
                          <Badge className="bg-rose-50 text-rose-700 border-rose-200">Deficient</Badge>
                        )}
                        {currentState === "deficient" && docStatus?.status === "DEFICIENT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setResubmitDocType(doc.doc_type);
                              setResubmitDialogOpen(true);
                            }}
                            className="h-8 text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Re-upload
                          </Button>
                        )}
                      </>
                    )}
                    {!docStatus && currentState === "deficient" && (
                      <Label
                        htmlFor={`resubmit-${doc.doc_type}`}
                        className="cursor-pointer h-8 px-3 text-sm bg-rose-600 hover:bg-rose-700 text-white rounded-lg"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        Upload
                      </Label>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions for specific states */}
      {(currentState === "submitted" || currentState === "eligibility_check") && (
        <Card className="border-slate-200 bg-white">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 mx-auto text-indigo-500" />
              <h3 className="text-lg font-semibold text-slate-900">Run Eligibility Check</h3>
              <p className="text-slate-600">
                Trigger the automated eligibility evaluation for your application.
                This will check your provided information against the scheme criteria.
              </p>
              <Button
                onClick={handleRunEligibilityCheck}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/25 py-3"
                size="lg"
              >
                <Shield className="w-5 h-5 mr-2" />
                Run Eligibility Check
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applicant Info */}
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            Application Details
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Full Name</p>
              <p className="font-medium text-slate-900">{application.applicant_name}</p>
            </div>
            <div>
              <p className="text-slate-500">Email</p>
              <p className="font-medium text-slate-900">{application.applicant_email}</p>
            </div>
            {application.applicant_phone && (
              <div>
                <p className="text-slate-500">Phone</p>
                <p className="font-medium text-slate-900">{application.applicant_phone}</p>
              </div>
            )}
            <div>
              <p className="text-slate-500">Application ID</p>
              <p className="font-mono text-slate-900 text-xs">{application.id}</p>
            </div>
            <div>
              <p className="text-slate-500">Scheme</p>
              <p className="font-medium text-slate-900">{scheme.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Submitted</p>
              <p className="font-medium text-slate-900">{new Date(application.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-slate-500">Last Updated</p>
              <p className="font-medium text-slate-900">{new Date(application.updated_at).toLocaleString()}</p>
            </div>
          </div>

          {application.applicant_data && Object.keys(application.applicant_data).length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-3">Submitted Form Data</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {Object.entries(application.applicant_data).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1 border-b border-slate-100 last:border-0">
                    <dt className="text-slate-500 capitalize">{key.replace(/_/g, " ")}:</dt>
                    <dd className="font-medium text-slate-900 text-right">{String(val)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resubmit Dialog */}
      <Dialog open={resubmitDialogOpen} onOpenChange={setResubmitDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Re-upload Document</DialogTitle>
            <DialogDescription>
              Upload a corrected version of the document. This will replace the previous submission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {resubmitDocType && (
              <div>
                <Label htmlFor="resubmit-file" className="block text-sm font-medium text-slate-700 mb-1">
                  Select File
                </Label>
                <input
                  id="resubmit-file"
                  type="file"
                  accept={requiredDocs.find((d) => d.doc_type === resubmitDocType)?.accepted_formats.map((f) => `.${f}`).join(",") || ""}
                  onChange={(e) => e.target.files?.[0] && setResubmitFile(e.target.files[0])}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
            )}
            {resubmitError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{resubmitError}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResubmitDialogOpen(false)} disabled={isResubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleResubmit}
              disabled={isResubmitting || !resubmitFile}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {isResubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </span>
              ) : (
                "Re-upload Document"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs for deficient state uploads */}
      {currentState === "deficient" && requiredDocs.map((doc) => (
        <input
          key={doc.doc_type}
          id={`resubmit-${doc.doc_type}`}
          type="file"
          accept={doc.accepted_formats.map((f) => `.${f}`).join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setResubmitDocType(doc.doc_type);
              setResubmitFile(file);
              setResubmitDialogOpen(true);
            }
          }}
          className="hidden"
        />
      ))}
    </div>
  );
}

function StatusPageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="border-slate-200">
        <div className="p-6 bg-slate-100 animate-pulse">
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-xl bg-slate-200" />
            <div className="flex-1">
              <Skeleton className="h-6 w-1/3 bg-slate-200" />
              <Skeleton className="h-4 w-1/2 bg-slate-200 mt-1" />
              <div className="flex gap-4 mt-2">
                <Skeleton className="h-4 w-24 bg-slate-200" />
                <Skeleton className="h-4 w-32 bg-slate-200" />
                <Skeleton className="h-4 w-32 bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-4">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="space-y-6 pl-14">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="w-12 h-12 rounded-full bg-slate-200" />
                <Skeleton className="h-6 w-1/4 bg-slate-200 mt-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-slate-200 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-slate-200" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}