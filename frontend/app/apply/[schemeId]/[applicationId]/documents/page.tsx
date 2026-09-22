"use client";

import React, { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import {
  getScheme, getApplication, getDocuments, runDocumentScrutiny, runEligibilityCheck,
  type SchemeRead, type ApplicationRead, type DocumentRead,
} from "@/lib/api";
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, XCircle, Upload, FileText, ArrowRight } from "lucide-react";

type UploadStatus = "pending" | "uploading" | "uploaded" | "error";
interface DocumentUploadState {
  docType: string; status: UploadStatus; file?: File; error?: string; documentId?: string;
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

  const { data: scheme, isLoading: schemeLoading } = useSWR<SchemeRead>(schemeId ? `/api/schemes/${schemeId}` : null, () => getScheme(schemeId!));
  const { data: application, isLoading: appLoading } = useSWR<ApplicationRead>(applicationId ? `/api/applications/${applicationId}` : null, () => getApplication(applicationId!));
  const { data: documents, isLoading: docsLoading, mutate: mutateDocs } = useSWR<DocumentRead[]>(applicationId ? `/api/applications/${applicationId}/documents` : null, () => getDocuments(applicationId!));

  React.useEffect(() => {
    if (scheme?.config?.required_documents && !initializedRef.current) {
      const initialStates: Record<string, DocumentUploadState> = {};
      for (const doc of scheme.config.required_documents) {
        const existing = documents?.find((d) => d.doc_type === doc.doc_type);
        initialStates[doc.doc_type] = existing
          ? { docType: doc.doc_type, status: "uploaded", documentId: existing.id }
          : { docType: doc.doc_type, status: "pending" };
      }
      setUploadStates(initialStates);
      initializedRef.current = true;
    }
  }, [scheme, documents]);

  const handleFileSelect = (docType: string, file: File) => {
    const docConfig = scheme?.config?.required_documents.find((d: any) => d.doc_type === docType);
    if (!docConfig) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !docConfig.accepted_formats.map((f: string) => f.toLowerCase()).includes(ext)) {
      setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], status: "error", error: `Invalid file type. Accepted: ${docConfig.accepted_formats.join(", ")}` } }));
      return;
    }
    setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], file, status: "pending", error: undefined } }));
  };

  const uploadDocument = useCallback(async (docType: string) => {
    const state = uploadStates[docType];
    if (!state.file) return;
    setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], status: "uploading", error: undefined } }));
    try {
      const formData = new FormData();
      formData.append("file", state.file);
      formData.append("doc_type", docType);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${applicationId}/documents`, { method: "POST", body: formData });
      if (!response.ok) {
        let detail: string; try { const b = await response.json(); detail = b.detail || JSON.stringify(b); } catch { detail = response.statusText; }
        throw new Error(detail);
      }
      const result = await response.json();
      setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], status: "uploaded", documentId: result.id, file: undefined } }));
      await mutateDocs();
    } catch (err) {
      setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], status: "error", error: err instanceof Error ? err.message : "Upload failed", file: undefined } }));
    }
  }, [applicationId, uploadStates, mutateDocs]);

  const removeDocument = useCallback(async (docType: string) => {
    const state = uploadStates[docType];
    if (!state.documentId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/applications/${applicationId}/documents/${state.documentId}`, { method: "DELETE" });
      setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], status: "pending", documentId: undefined } }));
      await mutateDocs();
    } catch (err) {
      setUploadStates((prev) => ({ ...prev, [docType]: { ...prev[docType], error: err instanceof Error ? err.message : "Failed to remove" } }));
    }
  }, [applicationId, uploadStates, mutateDocs]);

  const handleSubmitForReview = async () => {
    setSubmitError(null); setIsSubmitting(true);
    try {
      await runEligibilityCheck(applicationId);
      await runDocumentScrutiny(applicationId);
      router.push(`/apply/status/${applicationId}`);
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "Failed to submit"); }
    finally { setIsSubmitting(false); }
  };

  const requiredDocs = scheme?.config?.required_documents ?? [];
  const allRequiredUploaded = requiredDocs.filter((d: any) => d.required).every((d: any) => uploadStates[d.doc_type]?.status === "uploaded");
  const requiredDocsCount = requiredDocs.filter((d: any) => d.required).length;
  const uploadedCount = Object.values(uploadStates).filter((s) => s.status === "uploaded").length;

  if (schemeLoading || appLoading || docsLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (!scheme || !application) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Application Not Found</h2>
        <Link href="/apply" className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 inline-block mt-3">Back to Schemes</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href={`/apply/${schemeId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back</Link>
        <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold text-[#de5c36] bg-[#de5c36]/10 rounded-full">{scheme.code}</span>
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Upload Required Documents</h1>
        <p className="text-xs text-gray-500">Application for <strong>{application.applicant_name}</strong> ({scheme.name})</p>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-800">{uploadedCount} of {requiredDocsCount} uploaded</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#de5c36] to-[#e88a52] transition-all duration-300" style={{ width: `${requiredDocsCount > 0 ? (uploadedCount / requiredDocsCount) * 100 : 0}%` }} />
        </div>
      </div>

      {submitError && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><div><p className="font-medium">Unable to submit</p><p className="mt-0.5">{submitError}</p></div>
        </div>
      )}

      {/* Document Cards */}
      <div className="space-y-3">
        {requiredDocs.map((doc: any) => {
          const state = uploadStates[doc.doc_type];
          const isUploaded = state?.status === "uploaded";
          const isUploading = state?.status === "uploading";
          const hasError = state?.status === "error";
          const hasFile = state?.file;

          return (
            <div key={doc.doc_type} className={`bg-white rounded-xl border shadow-sm p-4 transition ${isUploaded ? "border-emerald-200" : hasError ? "border-rose-200" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isUploaded ? "bg-emerald-50 text-emerald-600" : hasError ? "bg-rose-50 text-rose-600" : "bg-gray-50 text-gray-400"}`}>
                    {isUploaded ? <CheckCircle2 className="w-5 h-5" /> : hasError ? <XCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{doc.label || doc.doc_type}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${doc.required ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{doc.required ? "Required" : "Optional"}</span>
                      <span className="text-[10px] font-mono text-gray-400">{doc.accepted_formats?.map((f: string) => f.toUpperCase()).join(", ")}</span>
                    </div>
                    {hasError && state?.error && <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{state.error}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isUploaded ? (
                    <button onClick={() => removeDocument(doc.doc_type)} className="px-2.5 py-1 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-600 rounded border border-gray-200">Remove</button>
                  ) : isUploading ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</div>
                  ) : hasFile ? (
                    <button onClick={() => uploadDocument(doc.doc_type)} className="px-3 py-1.5 text-[11px] font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg transition flex items-center gap-1"><Upload className="w-3 h-3" /> Upload</button>
                  ) : (
                    <label className="px-3 py-1.5 text-[11px] font-medium bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg border border-gray-200 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Select File
                      <input type="file" className="hidden" accept={doc.accepted_formats?.map((f: string) => `.${f}`).join(",")} onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(doc.doc_type, e.target.files[0]); }} />
                    </label>
                  )}
                </div>
              </div>
              {hasFile && !isUploading && <p className="text-[10px] text-gray-400 mt-2 pl-12">Selected: {state.file?.name}</p>}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="pt-4 border-t border-gray-200">
        <button onClick={handleSubmitForReview} disabled={!allRequiredUploaded || isSubmitting}
          className="w-full py-3 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <>Submit for Review <ArrowRight className="w-4 h-4" /></>}
        </button>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          {allRequiredUploaded ? "All required documents uploaded. Ready to submit." : `Upload ${requiredDocsCount - uploadedCount} more required document(s) to proceed.`}
        </p>
      </div>
    </div>
  );
}