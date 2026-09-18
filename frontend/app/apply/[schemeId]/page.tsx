"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import {
  getScheme,
  createApplication,
  type SchemeRead,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  User,
  Calendar,
  Info,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "cn";

interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "date" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
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

  // Derive form fields from scheme config
  const formFields = React.useMemo((): FormField[] => {
    if (!scheme?.config) return [];

    const fields: FormField[] = [
      // Fixed fields
      {
        name: "applicant_name",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "Enter your full name as per official documents",
        helpText: "Must match the name on your caste/income certificates",
      },
      {
        name: "applicant_email",
        label: "Email Address",
        type: "email",
        required: true,
        placeholder: "you@example.com",
        helpText: "We'll send application updates to this email",
      },
      {
        name: "applicant_phone",
        label: "Phone Number",
        type: "text",
        required: true,
        placeholder: "+91-XXXXXXXXXX",
        helpText: "Include country code (e.g., +91 for India)",
      },
    ];

    // Infer fields from eligibility rules
    const eligibilityRules = scheme.config.eligibility_rules ?? [];
    const seenFields = new Set(["applicant_name", "applicant_email", "applicant_phone", "age", "annual_income", "category", "qualification", "university", "qualifying_exam_percent", "admission_confirmed", "university_abroad", "course"]);

    for (const rule of eligibilityRules) {
      const fieldName = rule.field;
      if (seenFields.has(fieldName)) continue;
      seenFields.add(fieldName);

      const inferred = inferFieldFromRule(fieldName, rule);
      fields.push(inferred);
    }

    return fields;
  }, [scheme]);

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of formFields) {
      const value = formData[field.name];
      if (field.required && (value === undefined || value === null || value === "")) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        newErrors[field.name] = "Please enter a valid email address";
      }
      if (field.type === "number" && value !== undefined && value !== "" && isNaN(Number(value))) {
        newErrors[field.name] = "Please enter a valid number";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Prepare applicant_data from form fields (excluding fixed fields)
      const fixedFields = ["applicant_name", "applicant_email", "applicant_phone"];
      const applicantData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (!fixedFields.includes(key)) {
          // Convert numeric strings to numbers
          if (typeof value === "string" && !isNaN(Number(value)) && value !== "") {
            applicantData[key] = Number(value);
          } else if (value === "true" || value === "false") {
            applicantData[key] = value === "true";
          } else {
            applicantData[key] = value;
          }
        }
      }

      const response = await createApplication({
        scheme_id: schemeId,
        applicant_name: formData.applicant_name as string,
        applicant_email: formData.applicant_email as string,
        applicant_phone: formData.applicant_phone as string,
        applicant_data: applicantData,
      });

      // Redirect to document upload page
      router.push(`/apply/${schemeId}/${response.id}/documents`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit application";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <ApplicationFormSkeleton />;
  }

  if (error || !scheme) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Scheme Not Found</h2>
        <p className="text-slate-600 mb-6">The requested scholarship scheme could not be loaded.</p>
        <Link href="/apply">
          <Button variant="outline">Back to Schemes</Button>
        </Link>
      </div>
    );
  }

  const config = scheme.config;
  const requiredDocs = config?.required_documents ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back Link & Header */}
      <div className="flex items-center justify-between">
        <Link href="/apply" className="flex items-center gap-2 text-sm text-slate-600 hover:text-indigo-600 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Schemes
        </Link>
      </div>

      <div className="text-center space-y-3">
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-3 py-1">
          {scheme.code}
        </Badge>
        <h1 className="text-3xl font-bold text-slate-900">{scheme.name}</h1>
        <p className="text-slate-600 max-w-2xl mx-auto">{scheme.description}</p>
      </div>

      {submitError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Unable to submit application</p>
            <p className="text-sm mt-1">{submitError}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Applicant Information Section */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Applicant Information</CardTitle>
            </div>
            <CardDescription>Enter your personal details as they appear on official documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {formFields
              .filter((f) => ["applicant_name", "applicant_email", "applicant_phone"].includes(f.name))
              .map((field) => (
                <FormFieldComponent
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                  onChange={(v) => handleChange(field.name, v)}
                  error={errors[field.name]}
                />
              ))}
          </CardContent>
        </Card>

        {/* Scheme-Specific Fields Section */}
        {formFields.filter((f) => !["applicant_name", "applicant_email", "applicant_phone"].includes(f.name)).length > 0 && (
          <Card className="border-slate-200 bg-white">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg">Scheme-Specific Information</CardTitle>
              </div>
              <CardDescription>Fields required for eligibility evaluation for this scheme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {formFields
                .filter((f) => !["applicant_name", "applicant_email", "applicant_phone"].includes(f.name))
                .map((field) => (
                  <FormFieldComponent
                    key={field.name}
                    field={field}
                    value={formData[field.name]}
                    onChange={(v) => handleChange(field.name, v)}
                    error={errors[field.name]}
                  />
                ))}
            </CardContent>
          </Card>
        )}

        {/* Required Documents Preview */}
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg">Documents You Will Need</CardTitle>
            </div>
            <CardDescription>Prepare these documents for upload after submitting this form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            <ul className="space-y-2">
              {requiredDocs.map((doc) => (
                <li key={doc.doc_type} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{doc.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-2 py-0.5",
                        doc.required
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                      )}
                    >
                      {doc.required ? "Required" : "Optional"}
                    </Badge>
                    <span className="text-xs text-slate-500 font-mono">
                      {doc.accepted_formats.map((f) => f.toUpperCase()).join(", ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-200">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/25 py-3 text-lg"
            size="lg"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </span>
            ) : (
              <>
                Submit Application
                <CheckCircle2 className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-slate-500 mt-3">
            By submitting, you declare that the information provided is true and accurate to the best of your knowledge.
          </p>
        </div>
      </form>
    </div>
  );
}

function FormFieldComponent({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const inputClass = cn(
    "w-full",
    error && "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/20"
  );

  const renderInput = () => {
    switch (field.type) {
      case "select":
        return (
          <Select onValueChange={onChange} value={value as string}>
            <SelectTrigger className={inputClass}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "textarea":
        return (
          <Textarea
            className={inputClass}
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            className={inputClass}
            placeholder={field.placeholder}
            value={value as string | number}
            onChange={(e) => onChange(e.target.value)}
            step="any"
          />
        );
      case "date":
        return (
          <Input
            type="date"
            className={inputClass}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
          />
        );
      case "email":
        return (
          <Input
            type="email"
            className={inputClass}
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="email"
          />
        );
      default:
        return (
          <Input
            type="text"
            className={inputClass}
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={field.name === "applicant_name" ? "name" : field.name === "applicant_phone" ? "tel" : "off"}
          />
        );
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name} className="text-sm font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div id={field.name}>{renderInput()}</div>
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
      {!error && field.helpText && (
        <p className="text-xs text-slate-500">{field.helpText}</p>
      )}
    </div>
  );
}

function inferFieldFromRule(fieldName: string, rule: { condition: Record<string, unknown>; failure_message: string }): FormField {
  const lowerName = fieldName.toLowerCase();

  // Type inference from field name
  // NOTE: This is a known limitation. The config schema doesn't define field types/labels
  // for the form — only for eligibility conditions. A more robust version would add
  // a dedicated "applicant_form_fields" section to SchemeConfig, but that's out of scope.
  let type: FormField["type"] = "text";
  let options: FormField["options"] = undefined;

  if (lowerName.includes("income") || lowerName.includes("age") || lowerName.includes("percent") || lowerName.includes("amount") || lowerName.includes("salary")) {
    type = "number";
  } else if (lowerName.includes("email")) {
    type = "email";
  } else if (lowerName.includes("date") || lowerName.includes("dob") || lowerName.includes("birth")) {
    type = "date";
  } else if (lowerName.includes("category") || lowerName.includes("caste") || lowerName.includes("gender") || lowerName.includes("status")) {
    type = "select";
    // Try to infer options from condition
    const condition = rule.condition;
    if (condition && typeof condition === "object" && "==" in condition) {
      const eqCondition = condition["=="] as unknown[];
      if (Array.isArray(eqCondition) && eqCondition.length === 2) {
        const varPart = eqCondition[0];
        // const valuePart = eqCondition[1]; // unused - reserved for future option extraction
        if (varPart && typeof varPart === "object" && "var" in varPart) {
          // Could potentially extract allowed values from a more complex condition
          // For now, provide common defaults based on field name
        }
      }
    }
    // Default options for common fields
    if (lowerName.includes("category") || lowerName.includes("caste")) {
      options = [
        { value: "SC", label: "Scheduled Caste (SC)" },
        { value: "ST", label: "Scheduled Tribe (ST)" },
        { value: "OBC", label: "Other Backward Class (OBC)" },
        { value: "GEN", label: "General" },
      ];
    } else if (lowerName.includes("gender")) {
      options = [
        { value: "M", label: "Male" },
        { value: "F", label: "Female" },
        { value: "O", label: "Other" },
      ];
    }
  } else if (lowerName.includes("description") || lowerName.includes("address") || lowerName.includes("remark")) {
    type = "textarea";
  }

  // Generate label from field name
  const label = fieldName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    name: fieldName,
    label,
    type,
    required: true,
    options,
    helpText: rule.failure_message,
  };
}

function ApplicationFormSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-24 bg-slate-200 rounded-full mx-auto" />
        <Skeleton className="h-8 w-3/4 bg-slate-200 mx-auto" />
        <Skeleton className="h-5 w-1/2 bg-slate-200 mx-auto" />
      </div>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/4 bg-slate-200" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-16 bg-slate-200" />
            <Skeleton className="h-16 bg-slate-200" />
            <Skeleton className="h-16 bg-slate-200" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="space-y-3">
            <Skeleton className="h-16 bg-slate-200" />
            <Skeleton className="h-16 bg-slate-200" />
          </div>
        </CardContent>
      </Card>
      <Card className="border-slate-200">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-1/3 bg-slate-200" />
          <div className="space-y-2">
            <Skeleton className="h-10 bg-slate-200" />
            <Skeleton className="h-10 bg-slate-200" />
            <Skeleton className="h-10 bg-slate-200" />
            <Skeleton className="h-10 bg-slate-200" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-12 w-full bg-slate-200 rounded-lg" />
    </div>
  );
}