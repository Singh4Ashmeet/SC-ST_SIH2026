"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { getScheme, createApplication, type SchemeRead, type FormFieldSchema } from "@/lib/api";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, User, FileText, Info, ShieldCheck } from "lucide-react";

interface RenderableField {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "date" | "select" | "multiselect" | "boolean" | "textarea";
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

export default function ApplicationFormPage() {
  const params = useParams();
  const schemeId = params?.schemeId as string;
  const router = useRouter();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: scheme, isLoading, error } = useSWR<SchemeRead>(
    schemeId ? `/api/schemes/${schemeId}` : null,
    () => getScheme(schemeId!)
  );

  // Dynamically resolve form fields directly from Scheme's declarative form_schema
  const formFields = useMemo((): RenderableField[] => {
    if (!scheme?.config) return [];

    // 1. Primary Source of Truth: scheme.config.form_schema
    if (scheme.config.form_schema?.fields && scheme.config.form_schema.fields.length > 0) {
      return scheme.config.form_schema.fields.map((f: FormFieldSchema): RenderableField => {
        let normalizedOptions: { value: string; label: string }[] | undefined = undefined;
        if (f.options && Array.isArray(f.options)) {
          normalizedOptions = f.options.map((opt) => {
            if (typeof opt === "string") return { value: opt, label: opt };
            return { value: String(opt.value), label: String(opt.label || opt.value) };
          });
        }
        return {
          key: f.key,
          label: f.label || f.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          type: (f.type as RenderableField["type"]) || "text",
          required: f.required ?? true,
          placeholder: f.placeholder,
          helpText: f.help_text,
          options: normalizedOptions,
        };
      });
    }

    // 2. Intelligent Fallback for schemes without explicit form_schema (infer from rules without hardcoded suppression)
    const fields: RenderableField[] = [
      { key: "applicant_name", label: "Full Name", type: "text", required: true, placeholder: "Full name as per official documents", helpText: "Must match certificates" },
      { key: "applicant_email", label: "Email Address", type: "email", required: true, placeholder: "applicant@example.com", helpText: "Notifications will be sent here" },
      { key: "applicant_phone", label: "Phone Number", type: "text", required: true, placeholder: "+91-XXXXXXXXXX", helpText: "Include 10-digit mobile number" },
    ];

    const addedKeys = new Set(["applicant_name", "applicant_email", "applicant_phone"]);

    for (const rule of scheme.config.eligibility_rules ?? []) {
      if (addedKeys.has(rule.field)) continue;
      addedKeys.add(rule.field);
      fields.push(inferFieldFromRule(rule.field, rule));
    }

    return fields;
  }, [scheme]);

  const handleChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of formFields) {
      const v = formData[f.key];
      if (f.required && (v === undefined || v === null || v === "")) {
        newErrors[f.key] = `${f.label} is required`;
      }
      if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) {
        newErrors[f.key] = "Please enter a valid email address";
      }
      if (f.type === "number" && v !== undefined && v !== "" && isNaN(Number(v))) {
        newErrors[f.key] = "Please enter a valid numeric value";
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) {
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        document.getElementById(`field-${firstErrorKey}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Split into fixed applicant credentials & structured applicant_data
      const applicantName = String(formData.applicant_name || "Applicant");
      const applicantEmail = String(formData.applicant_email || "applicant@example.com");
      const applicantPhone = String(formData.applicant_phone || "");

      const applicantData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(formData)) {
        if (typeof v === "string" && !isNaN(Number(v)) && v.trim() !== "" && fIsNumeric(k, formFields)) {
          applicantData[k] = Number(v);
        } else if (v === "true" || v === "false") {
          applicantData[k] = v === "true";
        } else {
          applicantData[k] = v;
        }
      }

      const response = await createApplication({
        scheme_id: schemeId,
        applicant_name: applicantName,
        applicant_email: applicantEmail,
        applicant_phone: applicantPhone,
        applicant_data: applicantData,
      });

      // Proceed to the document verification and trust scrutinizer
      router.push(`/apply/${schemeId}/${response.id}/documents`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-[#de5c36] animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Loading scheme configuration & dynamic schema...</p>
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Scheme Unavailable</h2>
        <p className="text-xs text-gray-500 mb-5">The requested scholarship scheme configuration could not be loaded.</p>
        <Link href="/apply" className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Available Schemes
        </Link>
      </div>
    );
  }

  const primaryKeys = ["applicant_name", "applicant_email", "applicant_phone"];
  const identityFields = formFields.filter((f) => primaryKeys.includes(f.key));
  const schemeSpecificFields = formFields.filter((f) => !primaryKeys.includes(f.key));
  const requiredDocs = scheme.config?.required_documents ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes
      </Link>

      {/* Header banner */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#de5c36]/10 to-transparent rounded-bl-full pointer-events-none" />
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 text-[11px] font-bold text-[#de5c36] bg-[#de5c36]/10 rounded-full border border-[#de5c36]/20">
            {scheme.code}
          </span>
          <span className="px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
            Policy v{scheme.config.version} Active
          </span>
          <span className="px-2.5 py-0.5 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-full border border-blue-200">
            Dynamic Schema Engine
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{scheme.name}</h1>
        {scheme.description && (
          <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">{scheme.description}</p>
        )}
      </div>

      {submitError && (
        <div className="flex items-start gap-2.5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
          <div>
            <p className="font-semibold">Submission Incomplete</p>
            <p className="mt-0.5 text-rose-700">{submitError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Identity & Contact Information */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-[#de5c36]/10 flex items-center justify-center text-[#de5c36]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Applicant Identity & Contact</h3>
              <p className="text-[11px] text-gray-500">Official applicant credentials for verified correspondence</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {identityFields.map((field) => (
              <div key={field.key} id={`field-${field.key}`} className={field.key === "applicant_name" ? "sm:col-span-2" : ""}>
                <DynamicFormField
                  field={field}
                  value={formData[field.key]}
                  onChange={(v) => handleChange(field.key, v)}
                  error={errors[field.key]}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Declarative Scheme-Specific Criteria */}
        {schemeSpecificFields.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <div className="w-7 h-7 rounded-lg bg-[#105a8b]/10 flex items-center justify-center text-[#105a8b]">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Scheme-Specific Eligibility Criteria</h3>
                <p className="text-[11px] text-gray-500">
                  Rendered dynamically from the active scheme policy schema
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {schemeSpecificFields.map((field) => (
                <div key={field.key} id={`field-${field.key}`} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
                  <DynamicFormField
                    field={field}
                    value={formData[field.key]}
                    onChange={(v) => handleChange(field.key, v)}
                    error={errors[field.key]}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Required Evidence Overview */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Required Documentary Evidence</h3>
              <p className="text-[11px] text-gray-500">Documents verified by the automated OCR Document Trust Engine</p>
            </div>
          </div>

          <div className="space-y-2">
            {requiredDocs.map((doc) => (
              <div key={doc.doc_type} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <div>
                  <span className="font-semibold text-gray-800">{doc.label || doc.doc_type}</span>
                  {doc.issuing_authority && (
                    <span className="text-[10px] text-gray-400 block mt-0.5">Issuing Authority: {doc.issuing_authority}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    doc.required ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-gray-100 text-gray-600 border-gray-200"
                  }`}>
                    {doc.required ? "Mandatory" : "Optional"}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200">
                    {doc.accepted_formats?.map((fmt: string) => fmt.toUpperCase()).join(", ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit button */}
        <div className="space-y-2 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting Application...
              </>
            ) : (
              <>
                Submit Application & Proceed to Evidence Upload
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>All submissions are cryptographically logged in the tamper-evident hash chain.</span>
          </div>
        </div>
      </form>
    </div>
  );
}

function DynamicFormField({
  field,
  value,
  onChange,
  error,
}: {
  field: RenderableField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  const baseInputClass =
    "w-full px-3.5 py-2.5 text-xs font-normal text-gray-800 bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#de5c36]/20 transition placeholder:text-gray-400";
  const inputClass = `${baseInputClass} ${error ? "border-rose-400 bg-rose-50/20 ring-1 ring-rose-200" : "border-gray-200 hover:border-gray-300"}`;

  const renderInput = () => {
    switch (field.type) {
      case "select":
        return (
          <select
            value={value !== undefined && value !== null ? String(value) : ""}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} cursor-pointer`}
          >
            <option value="">{field.placeholder || "-- Select an option --"}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <div className="flex items-center gap-4 py-1.5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
              <input
                type="radio"
                name={`bool-${field.key}`}
                checked={value === true || value === "true"}
                onChange={() => onChange(true)}
                className="w-4 h-4 text-[#de5c36] focus:ring-[#de5c36]"
              />
              Yes
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
              <input
                type="radio"
                name={`bool-${field.key}`}
                checked={value === false || value === "false"}
                onChange={() => onChange(false)}
                className="w-4 h-4 text-[#de5c36] focus:ring-[#de5c36]"
              />
              No
            </label>
          </div>
        );

      case "textarea":
        return (
          <textarea
            rows={3}
            className={inputClass}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "number":
        return (
          <input
            type="number"
            step="any"
            className={inputClass}
            placeholder={field.placeholder || "0"}
            value={(value as string | number) ?? ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className={inputClass}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case "email":
        return (
          <input
            type="email"
            className={inputClass}
            placeholder={field.placeholder || "email@example.com"}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="email"
          />
        );

      default:
        return (
          <input
            type="text"
            className={inputClass}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-700">
          {field.label}
          {field.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
        </label>
        {field.helpText && (
          <span className="text-[10px] text-gray-400 font-normal hidden sm:inline-block">
            {field.helpText}
          </span>
        )}
      </div>
      {renderInput()}
      {error && (
        <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1 mt-1">
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function inferFieldFromRule(
  fieldName: string,
  rule: { condition: Record<string, unknown>; failure_message: string }
): RenderableField {
  const lower = fieldName.toLowerCase();
  let type: RenderableField["type"] = "text";
  let options: RenderableField["options"] = undefined;

  if (lower.includes("income") || lower.includes("age") || lower.includes("percent") || lower.includes("amount") || lower.includes("marks")) {
    type = "number";
  } else if (lower.includes("email")) {
    type = "email";
  } else if (lower.includes("date") || lower.includes("dob") || lower.includes("birth")) {
    type = "date";
  } else if (lower.includes("confirmed") || lower.includes("is_") || lower.includes("has_")) {
    type = "boolean";
  } else if (lower.includes("category") || lower.includes("caste")) {
    type = "select";
    options = [
      { value: "ST", label: "Scheduled Tribe (ST)" },
      { value: "SC", label: "Scheduled Caste (SC)" },
      { value: "OBC", label: "Other Backward Class (OBC)" },
      { value: "GEN", label: "General" },
    ];
  } else if (lower.includes("gender")) {
    type = "select";
    options = [
      { value: "M", label: "Male" },
      { value: "F", label: "Female" },
      { value: "O", label: "Other" },
    ];
  }

  return {
    key: fieldName,
    label: fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type,
    required: true,
    options,
    helpText: rule.failure_message,
  };
}

function fIsNumeric(key: string, fields: RenderableField[]): boolean {
  const f = fields.find((item) => item.key === key);
  return f?.type === "number";
}