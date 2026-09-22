"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { getScheme, createApplication, type SchemeRead } from "@/lib/api";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, User, Calendar, Info } from "lucide-react";

interface FormField {
  name: string; label: string; type: "text" | "number" | "email" | "date" | "select" | "textarea";
  required: boolean; placeholder?: string; options?: { value: string; label: string }[]; helpText?: string;
}

export default function ApplicationFormPage() {
  const params = useParams();
  const schemeId = params?.schemeId as string;
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: scheme, isLoading, error } = useSWR<SchemeRead>(schemeId ? `/api/schemes/${schemeId}` : null, () => getScheme(schemeId!));

  const formFields = React.useMemo((): FormField[] => {
    if (!scheme?.config) return [];
    const fields: FormField[] = [
      { name: "applicant_name", label: "Full Name", type: "text", required: true, placeholder: "Full name as per official documents", helpText: "Must match caste/income certificates" },
      { name: "applicant_email", label: "Email Address", type: "email", required: true, placeholder: "you@example.com", helpText: "Application updates sent here" },
      { name: "applicant_phone", label: "Phone Number", type: "text", required: true, placeholder: "+91-XXXXXXXXXX", helpText: "Include country code" },
    ];
    const seenFields = new Set(["applicant_name", "applicant_email", "applicant_phone", "age", "annual_income", "category", "qualification", "university", "qualifying_exam_percent", "admission_confirmed", "university_abroad", "course"]);
    for (const rule of (scheme.config.eligibility_rules ?? [])) {
      if (seenFields.has(rule.field)) continue;
      seenFields.add(rule.field);
      fields.push(inferFieldFromRule(rule.field, rule));
    }
    return fields;
  }, [scheme]);

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of formFields) {
      const v = formData[f.name];
      if (f.required && (v === undefined || v === null || v === "")) newErrors[f.name] = `${f.label} is required`;
      if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) newErrors[f.name] = "Invalid email";
      if (f.type === "number" && v !== undefined && v !== "" && isNaN(Number(v))) newErrors[f.name] = "Invalid number";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitError(null);
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      const fixedFields = ["applicant_name", "applicant_email", "applicant_phone"];
      const applicantData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (!fixedFields.includes(key)) {
          if (typeof value === "string" && !isNaN(Number(value)) && value !== "") applicantData[key] = Number(value);
          else if (value === "true" || value === "false") applicantData[key] = value === "true";
          else applicantData[key] = value;
        }
      }
      const response = await createApplication({
        scheme_id: schemeId, applicant_name: formData.applicant_name as string,
        applicant_email: formData.applicant_email as string, applicant_phone: formData.applicant_phone as string,
        applicant_data: applicantData,
      });
      router.push(`/apply/${schemeId}/${response.id}/documents`);
    } catch (err) { setSubmitError(err instanceof Error ? err.message : "Failed to submit"); }
    finally { setIsSubmitting(false); }
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>;
  if (error || !scheme) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Scheme Not Found</h2>
        <p className="text-xs text-gray-500 mb-4">The requested scheme could not be loaded.</p>
        <Link href="/apply" className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">Back to Schemes</Link>
      </div>
    );
  }

  const requiredDocs = scheme.config?.required_documents ?? [];
  const fixedFieldNames = ["applicant_name", "applicant_email", "applicant_phone"];
  const schemeFields = formFields.filter((f) => !fixedFieldNames.includes(f.name));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/apply" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900"><ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes</Link>

      <div className="text-center space-y-2">
        <span className="inline-block px-2.5 py-0.5 text-[11px] font-bold text-[#de5c36] bg-[#de5c36]/10 rounded-full">{scheme.code}</span>
        <h1 className="text-2xl font-bold text-gray-900">{scheme.name}</h1>
        {scheme.description && <p className="text-xs text-gray-500">{scheme.description}</p>}
      </div>

      {submitError && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><div><p className="font-medium">Unable to submit</p><p className="mt-0.5">{submitError}</p></div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Applicant Info */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100"><User className="w-4 h-4 text-[#de5c36]" /><h3 className="text-sm font-bold text-gray-900">Applicant Information</h3></div>
          {formFields.filter((f) => fixedFieldNames.includes(f.name)).map((field) => (
            <FormFieldComponent key={field.name} field={field} value={formData[field.name]} onChange={(v) => handleChange(field.name, v)} error={errors[field.name]} />
          ))}
        </div>

        {/* Scheme-Specific Fields */}
        {schemeFields.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100"><Calendar className="w-4 h-4 text-[#de5c36]" /><h3 className="text-sm font-bold text-gray-900">Scheme-Specific Information</h3></div>
            {schemeFields.map((field) => (
              <FormFieldComponent key={field.name} field={field} value={formData[field.name]} onChange={(v) => handleChange(field.name, v)} error={errors[field.name]} />
            ))}
          </div>
        )}

        {/* Documents Preview */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100"><Info className="w-4 h-4 text-[#de5c36]" /><h3 className="text-sm font-bold text-gray-900">Documents You Will Need</h3></div>
          <ul className="space-y-2">
            {requiredDocs.map((doc: any) => (
              <li key={doc.doc_type} className="flex items-center justify-between text-xs">
                <span className="text-gray-700">{doc.label || doc.doc_type}</span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${doc.required ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{doc.required ? "Required" : "Optional"}</span>
                  <span className="text-[10px] font-mono text-gray-400">{doc.accepted_formats?.map((f: string) => f.toUpperCase()).join(", ")}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" disabled={isSubmitting}
          className="w-full py-3 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2">
          {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</> : <>Submit Application <CheckCircle2 className="w-5 h-5" /></>}
        </button>
        <p className="text-center text-[10px] text-gray-400">By submitting, you declare all information is true and accurate.</p>
      </form>
    </div>
  );
}

function FormFieldComponent({ field, value, onChange, error }: { field: FormField; value: unknown; onChange: (v: unknown) => void; error?: string }) {
  const base = "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36]";
  const cls = `${base} ${error ? "border-rose-400 bg-rose-50/50" : "border-gray-200 bg-gray-50/50"}`;

  const renderInput = () => {
    switch (field.type) {
      case "select":
        return (
          <select value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} className={cls}>
            <option value="">{field.placeholder || "Select..."}</option>
            {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      case "textarea": return <textarea className={`${cls} h-20`} placeholder={field.placeholder} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} />;
      case "number": return <input type="number" step="any" className={cls} placeholder={field.placeholder} value={(value as string | number) ?? ""} onChange={(e) => onChange(e.target.value)} />;
      case "date": return <input type="date" className={cls} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} />;
      case "email": return <input type="email" className={cls} placeholder={field.placeholder} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} autoComplete="email" />;
      default: return <input type="text" className={cls} placeholder={field.placeholder} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} autoComplete={field.name === "applicant_name" ? "name" : field.name === "applicant_phone" ? "tel" : "off"} />;
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-[11px] text-gray-500 font-medium">{field.label}{field.required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      {renderInput()}
      {error && <p className="text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {!error && field.helpText && <p className="text-[10px] text-gray-400">{field.helpText}</p>}
    </div>
  );
}

function inferFieldFromRule(fieldName: string, rule: { condition: Record<string, unknown>; failure_message: string }): FormField {
  const lower = fieldName.toLowerCase();
  let type: FormField["type"] = "text";
  let options: FormField["options"] = undefined;
  if (lower.includes("income") || lower.includes("age") || lower.includes("percent") || lower.includes("amount")) type = "number";
  else if (lower.includes("email")) type = "email";
  else if (lower.includes("date") || lower.includes("dob") || lower.includes("birth")) type = "date";
  else if (lower.includes("category") || lower.includes("caste") || lower.includes("gender")) {
    type = "select";
    if (lower.includes("category") || lower.includes("caste")) options = [{ value: "SC", label: "Scheduled Caste (SC)" }, { value: "ST", label: "Scheduled Tribe (ST)" }, { value: "OBC", label: "Other Backward Class (OBC)" }, { value: "GEN", label: "General" }];
    else if (lower.includes("gender")) options = [{ value: "M", label: "Male" }, { value: "F", label: "Female" }, { value: "O", label: "Other" }];
  } else if (lower.includes("description") || lower.includes("address")) type = "textarea";
  return { name: fieldName, label: fieldName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), type, required: true, options, helpText: rule.failure_message };
}