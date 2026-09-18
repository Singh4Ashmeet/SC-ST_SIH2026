"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import {
  getApplication,
  getScheme,
  getDocuments,
  getDeficiencySummary,
  runDocumentScrutiny,
  resubmitDocument,
  type ApplicationRead,
  type SchemeRead,
  type DocumentRead,
  type DeficiencySummary,
} from "@/lib/api";
import {
  ArrowLeft,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Play,
  Upload,
  Clock,
  Loader2,
  FileText,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ScrutinyDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data: app, isLoading: appLoading, mutate: mutateApp } = useSWR<ApplicationRead>(
    id ? `/api/applications/${id}` : null,
    () => getApplication(id)
  );

  const { data: scheme } = useSWR<SchemeRead>(
    app?.scheme_id ? `/api/schemes/${app.scheme_id}` : null,
    () => getScheme(app!.scheme_id)
  );

  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    id ? `/api/applications/${id}/documents` : null,
    () => getDocuments(id)
  );

  const { data: deficiencySummary, mutate: mutateDeficiency } = useSWR<DeficiencySummary>(
    id ? `/api/applications/${id}/deficiency-summary` : null,
    () => getDeficiencySummary(id)
  );

  const [isRunningScrutiny, setIsRunningScrutiny] = useState(false);
  const [scrutinySuccessMsg, setScrutinySuccessMsg] = useState<string | null>(null);

  // Resubmit modal state
  const [resubmitDoc, setResubmitDoc] = useState<DocumentRead | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleRunScrutiny = async () => {
    setIsRunningScrutiny(true);
    setScrutinySuccessMsg(null);
    try {
      const res = await runDocumentScrutiny(id);
      setScrutinySuccessMsg("Document scrutiny executed successfully. Review findings below.");
      // Mutate all relevant data
      mutateApp();
      mutateDocs();
      mutateDeficiency();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to run document scrutiny");
    } finally {
      setIsRunningScrutiny(false);
    }
  };

  const handleResubmit = async () => {
    if (!resubmitDoc || !selectedFile) return;

    setIsUploading(true);
    try {
      await resubmitDocument(id, resubmitDoc.id, selectedFile);
      setResubmitDoc(null);
      setSelectedFile(null);
      // Refresh documents and deficiency summary
      mutateApp();
      mutateDocs();
      mutateDeficiency();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to upload replacement document");
    } finally {
      setIsUploading(false);
    }
  };

  if (appLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-64 w-full bg-slate-800" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-8 text-center text-slate-400">
        Application not found.
      </div>
    );
  }

  const missingDocs = deficiencySummary?.missing_documents || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link href="/dashboard/scrutiny">
          <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white text-xs h-8">
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Scrutiny Queue
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/applications/${app.id}`}>
            <Button variant="outline" size="sm" className="text-xs h-8 border-slate-800 bg-slate-900 text-slate-300">
              View Application
            </Button>
          </Link>

          <Button
            id="run-scrutiny-btn"
            size="sm"
            onClick={handleRunScrutiny}
            disabled={isRunningScrutiny}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 shadow-md shadow-indigo-600/20"
          >
            {isRunningScrutiny ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Executing OCR Scrutiny...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                Run Document Scrutiny
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Header Banner */}
      <Card className="bg-slate-900/70 border-slate-800 text-slate-100 backdrop-blur-sm p-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                {scheme?.code || "SCHEME"}
              </span>
              <Badge
                className={
                  app.current_state === "deficient"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs"
                }
              >
                {app.current_state === "deficient" ? "Deficient Notice" : "Document Scrutiny Stage"}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
              Scrutiny Workbench: {app.applicant_name}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Candidate Email: {app.applicant_email} • Application ID: {app.id}
            </p>
          </div>

          <div className="text-right text-xs text-slate-400">
            <div>Verification Status:</div>
            <div className="font-semibold text-slate-200 mt-0.5 capitalize">
              {app.current_state.replace("_", " ")}
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {scrutinySuccessMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{scrutinySuccessMsg}</span>
          </div>
        )}

        {/* Missing Documents Alert */}
        {missingDocs.length > 0 && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-lg text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold text-rose-200">Mandatory Documents Missing:</div>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-rose-300 font-mono">
                {missingDocs.map((docType, idx) => (
                  <li key={idx}>{docType}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* Uploaded Documents List */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white tracking-tight">
          Submitted Certificates & Documents ({documents?.length ?? 0})
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {docsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full bg-slate-800" />
              <Skeleton className="h-32 w-full bg-slate-800" />
            </div>
          ) : documents && documents.length > 0 ? (
            documents.map((doc) => {
              const isDeficient = doc.status === "DEFICIENT";
              const isVerified = doc.status === "VERIFIED";

              return (
                <Card
                  key={doc.id}
                  className={`bg-slate-900/70 border text-slate-100 p-5 space-y-4 backdrop-blur-sm ${
                    isDeficient
                      ? "border-rose-900/60"
                      : isVerified
                      ? "border-emerald-900/40"
                      : "border-slate-800"
                  }`}
                >
                  {/* Top line: doc_type & Status Badge */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-300">
                          {doc.doc_type}
                        </span>
                        {isVerified ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Verified
                          </Badge>
                        ) : isDeficient ? (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                            Deficient
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            Pending Review
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Uploaded {new Date(doc.uploaded_at).toLocaleString()} • Storage Key:{" "}
                        <span className="font-mono text-slate-500">{doc.storage_key}</span>
                      </div>
                    </div>

                    {/* Resubmit button */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setResubmitDoc(doc);
                          setSelectedFile(null);
                        }}
                        className="text-xs h-7 border-slate-700 bg-slate-800/80 text-slate-200 hover:text-white"
                      >
                        <Upload className="w-3 h-3 mr-1.5" />
                        Resubmit Document
                      </Button>
                    </div>
                  </div>

                  {/* Deficiencies warning box if any */}
                  {doc.deficiency_reasons && doc.deficiency_reasons.length > 0 && (
                    <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg space-y-1">
                      <div className="text-[11px] font-semibold text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        Deficiency Findings:
                      </div>
                      <div className="space-y-1 pl-5">
                        {doc.deficiency_reasons.map((reason, rIdx) => (
                          <div key={rIdx} className="text-xs text-rose-200">
                            <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-rose-900/40 border border-rose-800/50 mr-1.5">
                              {reason.code}
                            </span>
                            <span>{reason.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OCR Extracted Fields */}
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      OCR Extracted Attributes
                    </div>
                    {doc.extracted_fields && Object.keys(doc.extracted_fields).length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {Object.entries(doc.extracted_fields).map(([k, v]) => (
                          <div
                            key={k}
                            className="p-2 rounded bg-slate-950/60 border border-slate-800/80 text-xs"
                          >
                            <div className="text-[10px] text-slate-500 capitalize">{k.replace(/_/g, " ")}</div>
                            <div className="font-semibold text-slate-200 truncate mt-0.5 font-mono text-[11px]">
                              {String(v)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">
                        No OCR fields extracted yet. Click &quot;Run Document Scrutiny&quot; to execute automated extraction.
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          ) : (
            <Card className="p-8 text-center text-xs text-slate-500 bg-slate-900/40 border-slate-800">
              No documents submitted for this application.
            </Card>
          )}
        </div>
      </div>

      {/* Resubmit Modal */}
      {resubmitDoc && (
        <Dialog open={!!resubmitDoc} onOpenChange={(open) => !open && setResubmitDoc(null)}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base text-white">
                Resubmit Document: {resubmitDoc.doc_type}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Upload a corrected certificate or document to address identified deficiencies.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">Document Type:</div>
                <div className="font-mono text-indigo-300 font-semibold">{resubmitDoc.doc_type}</div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Select Replacement File</label>
                <input
                  type="file"
                  id="resubmit-file-input"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer border border-slate-800 rounded-lg p-2 bg-slate-950"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResubmitDoc(null)}
                className="text-xs text-slate-400"
              >
                Cancel
              </Button>
              <Button
                id="confirm-resubmit-btn"
                size="sm"
                disabled={!selectedFile || isUploading}
                onClick={handleResubmit}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Confirm Resubmission
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
