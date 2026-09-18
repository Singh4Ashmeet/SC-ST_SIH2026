"use client";

import React, { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  getScheme,
  getApplication,
  getDocuments,
  runDocumentScrutiny,
  runEligibilityCheck,
  type SchemeRead,
  type ApplicationRead,
  type DocumentRead,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Upload,
  FileText,
  RefreshCw,
  ArrowRight,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

type UploadStatus = "pending" | "uploading" | "uploaded" | "error";

interface DocumentUploadState {
  docType: string;
  status: UploadStatus;
  file?: File;
  error?: string;
  documentId?: string;
  progress?: number;
}

export default function DocumentUploadPage() {
  const params = useParams();
  const schemeId = params?.schemeId as string;
  const applicationId = params?.applicationId as string;
  const router = useRouter();

  const [uploadStates, setUploadStates] = useState<Record<string, DocumentUploadState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const initializedRef = React.useRef(false);

  const { data: scheme, isLoading: schemeLoading } = useSWR<SchemeRead>(
    schemeId ? `/api/schemes/${schemeId}` : null,
    () => getScheme(schemeId!)
  );

  const { data: application, isLoading: appLoading } = useSWR<ApplicationRead>(
    applicationId ? `/api/applications/${applicationId}` : null,
    () => getApplication(applicationId!)
  );

  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(
    applicationId ? `/api/applications/${applicationId}/documents` : null,
    () => getDocuments(applicationId!)
  );

  // Initialize upload states from required documents
  React.useEffect(() => {
    if (scheme?.config?.required_documents && !initializedRef.current) {
      const initialStates: Record<string, DocumentUploadState> = {};
      for (const doc of scheme.config.required_documents) {
        // Check if already uploaded
        const existingDoc = documents?.find((d) => d.doc_type === doc.doc_type);
        if (existingDoc) {
          initialStates[doc.doc_type] = {
            docType: doc.doc_type,
            status: "uploaded",
            documentId: existingDoc.id,
          };
        } else {
          initialStates[doc.doc_type] = {
            docType: doc.doc_type,
            status: "pending",
          };
        }
      }
      setUploadStates(initialStates);
      initializedRef.current = true;
    }
  }, [scheme, documents]);

  const handleFileSelect = (docType: string, file: File) => {
    const docConfig = scheme?.config?.required_documents.find((d) => d.doc_type === docType);
    if (!docConfig) return;

    // Validate file extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !docConfig.accepted_formats.map((f) => f.toLowerCase()).includes(ext)) {
      setUploadStates((prev) => ({
        ...prev,
        [docType]: {
          ...prev[docType],
          status: "error",
          error: `Invalid file type. Accepted: ${docConfig.accepted_formats.join(", ")}`,
        },
      }));
      return;
    }

    setUploadStates((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        file,
        status: "pending",
        error: undefined,
      },
    }));
  };

  const uploadDocument = useCallback(
    async (docType: string) => {
      const state = uploadStates[docType];
      if (!state.file) return;

      setUploadStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], status: "uploading", progress: 0, error: undefined },
      }));

      try {
        const formData = new FormData();
        formData.append("file", state.file);
        formData.append("doc_type", docType);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${applicationId}/documents`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          let detail: string | Record<string, unknown>;
          try {
            const body = await response.json();
            detail = body.detail || body;
          } catch {
            detail = response.statusText;
          }
          throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        }

        const result = await response.json();

        setUploadStates((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "uploaded",
            documentId: result.id,
            file: undefined,
          },
        }));

        await mutateDocs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploadStates((prev) => ({
          ...prev,
          [docType]: {
            ...prev[docType],
            status: "error",
            error: message,
            file: undefined,
          },
        }));
      }
    },
    [applicationId, uploadStates, mutateDocs]
  );

  const removeDocument = useCallback(
    async (docType: string) => {
      const state = uploadStates[docType];
      if (!state.documentId) return;

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${applicationId}/documents/${state.documentId}`,
          {
            method: "DELETE",
          }
        );

        setUploadStates((prev) => ({
          ...prev,
          [docType]: { ...prev[docType], status: "pending", documentId: undefined },
        }));

        await mutateDocs();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to remove document";
        setUploadStates((prev) => ({
          ...prev,
          [docType]: { ...prev[docType], error: message },
        }));
      }
    },
    [applicationId, uploadStates, mutateDocs]
  );

  const handleSubmitForReview = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // First, run eligibility check
      await runEligibilityCheck(applicationId);

      // Then run document scrutiny
      await runDocumentScrutiny(applicationId);

      // Redirect to status page
      router.push(`/apply/status/${applicationId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit for review";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredDocs = scheme?.config?.required_documents ?? [];
  const allRequiredUploaded = requiredDocs
    .filter((d) => d.required)
    .every((d) => uploadStates[d.doc_type]?.status === "uploaded");

  const loading = schemeLoading || appLoading || docsLoading;

  if (loading) {
    return <DocumentUploadSkeleton />;
  }

  if (!scheme || !application) {
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

  const requiredDocsCount = requiredDocs.filter((d) => d.required).length;
  const uploadedCount = Object.values(uploadStates).filter((s) => s.status === "uploaded").length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href={`/apply/${schemeId}`}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Application
        </Link>
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-3 py-1">
          {scheme.code}
        </Badge>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">Upload Required Documents</h1>
        <p className="text-slate-600">
          Application for <strong>{application.applicant_name}</strong> ({scheme.name})
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Progress</span>
          <span className="font-medium text-slate-900">
            {uploadedCount} of {requiredDocsCount} required documents uploaded
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${requiredDocsCount > 0 ? (uploadedCount / requiredDocsCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Unable to submit for review</p>
            <p className="text-sm mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Documents List */}
      <Card className="border-slate-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            Required Documents
          </CardTitle>
          <CardDescription>
            Upload each required document. You can replace documents before submitting for review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {requiredDocs.map((doc) => (
            <DocumentUploadCard
              key={doc.doc_type}
              doc={doc}
              state={uploadStates[doc.doc_type] || { docType: doc.doc_type, status: "pending" }}
              onFileSelect={handleFileSelect}
              onUpload={uploadDocument}
              onRemove={removeDocument}
            />
          ))}
        </CardContent>
      </Card>

      {/* Submit for Review */}
      <Card className="border-slate-200 bg-white">
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Separator className="border-slate-200" />

            <div className="text-center space-y-3">
              <Shield className="w-12 h-12 mx-auto text-indigo-500" />
              <h3 className="text-lg font-semibold text-slate-900">Ready to Submit?</h3>
              <p className="text-slate-600">
                Once all required documents are uploaded, submit your application for
                automated eligibility check and document scrutiny.
              </p>
            </div>

            <Button
              onClick={handleSubmitForReview}
              disabled={!allRequiredUploaded || isSubmitting}
              className={cn(
                "w-full py-3 text-lg",
                allRequiredUploaded
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/25"
                  : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
              )}
              size="lg"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting for Review...
                </span>
              ) : (
                <>
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>

            {!allRequiredUploaded && (
              <p className="text-center text-sm text-slate-500">
                Please upload all {requiredDocsCount} required document(s) to enable submission.
              </p>
            )}

            <p className="text-center text-xs text-slate-500">
              This will trigger automated eligibility evaluation and document verification.
              You can track progress on the status page.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DocumentUploadCard({
  doc,
  state,
  onFileSelect,
  onUpload,
  onRemove,
}: {
  doc: { doc_type: string; label: string; required: boolean; accepted_formats: string[] };
  state: DocumentUploadState;
  onFileSelect: (docType: string, file: File) => void;
  onUpload: (docType: string) => void;
  onRemove: (docType: string) => void;
}) {
  const getStatusIcon = () => {
    switch (state.status) {
      case "uploaded":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "uploading":
        return <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Upload className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case "uploaded":
        return "Uploaded";
      case "uploading":
        return `Uploading...${state.progress ? ` ${state.progress}%` : ""}`;
      case "error":
        return "Upload Failed";
      default:
        return "Not Uploaded";
    }
  };

  const getStatusBadge = () => {
    switch (state.status) {
      case "uploaded":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Uploaded</Badge>;
      case "uploading":
        return <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">Uploading...</Badge>;
      case "error":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Error</Badge>;
      default:
        return (
          <Badge
            variant="outline"
            className={cn(
              "bg-slate-50 text-slate-700 border-slate-200",
              doc.required && "text-red-700 border-red-200 bg-red-50"
            )}
          >
            {doc.required ? "Required" : "Optional"}
          </Badge>
        );
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-all",
        state.status === "uploaded" && "bg-emerald-50 border-emerald-200",
        state.status === "error" && "bg-red-50 border-red-200",
        state.status === "uploading" && "bg-indigo-50 border-indigo-200",
        state.status === "pending" && "bg-slate-50 border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-white border flex items-center justify-center flex-shrink-0">
            {getStatusIcon()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-slate-900 truncate">{doc.label}</h4>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-slate-500 truncate mt-0.5">
              {doc.accepted_formats.map((f) => f.toUpperCase()).join(", ")} • {getStatusText()}
            </p>
            {state.error && (
              <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                {state.error}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state.status === "uploaded" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(doc.doc_type)}
                className="h-8 text-xs text-red-600 hover:bg-red-50 border-red-200"
              >
                Replace
              </Button>
            </>
          ) : state.status === "uploading" ? (
            <Button variant="outline" size="sm" disabled className="h-8 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </Button>
          ) : state.status === "error" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpload(doc.doc_type)}
              className="h-8 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />
              Retry
            </Button>
          ) : (
            <>
              <input
                type="file"
                accept={doc.accepted_formats.map((f) => `.${f}`).join(",")}
                onChange={(e) => e.target.files?.[0] && onFileSelect(doc.doc_type, e.target.files[0])}
                className="hidden"
                id={`file-${doc.doc_type}`}
              />
              <Label
                htmlFor={`file-${doc.doc_type}`}
                className="cursor-pointer h-8 px-3 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Upload
              </Label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentUploadSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 bg-slate-200 rounded-full" />
        <Skeleton className="h-6 w-1/2 bg-slate-200" />
        <Skeleton className="h-4 w-1/3 bg-slate-200" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-16 bg-slate-200" />
          <Skeleton className="h-4 w-24 bg-slate-200" />
        </div>
        <Skeleton className="h-2 w-full bg-slate-200 rounded-full" />
      </div>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="space-y-3">
            <Skeleton className="h-20 bg-slate-200 rounded-lg" />
            <Skeleton className="h-20 bg-slate-200 rounded-lg" />
            <Skeleton className="h-20 bg-slate-200 rounded-lg" />
            <Skeleton className="h-20 bg-slate-200 rounded-lg" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-12 w-12 bg-slate-200 rounded-full mx-auto" />
          <Skeleton className="h-5 w-1/2 bg-slate-200 mx-auto" />
          <Skeleton className="h-4 w-3/4 bg-slate-200 mx-auto" />
          <Skeleton className="h-12 w-full bg-slate-200 rounded-lg" />
        </CardContent>
      </Card>
    </div>
  );
}