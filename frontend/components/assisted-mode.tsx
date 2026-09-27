"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Sparkles,
  HelpCircle,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Save,
  Globe2,
  FileText,
  ShieldCheck,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";

export interface RenderableField {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "date" | "select" | "multiselect" | "boolean" | "textarea";
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

interface RequiredDocInfo {
  doc_type: string;
  label?: string;
  required?: boolean;
  description?: string;
  accepted_formats?: string[];
}

interface AssistedModeProps {
  schemeName: string;
  schemeCode: string;
  formFields: RenderableField[];
  requiredDocs?: RequiredDocInfo[];
  formData: Record<string, any>;
  onUpdateField: (key: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onClose: () => void;
  submitError?: string | null;
}

type Language = "en" | "hi";

interface Translation {
  title: string;
  subtitle: string;
  step: string;
  of: string;
  saveResume: string;
  draftSaved: string;
  next: string;
  prev: string;
  submit: string;
  submitting: string;
  checklistTitle: string;
  reviewTitle: string;
  reviewDesc: string;
  declaration: string;
  missingFieldsWarning: string;
  fixField: string;
  stepNames: {
    personal: string;
    personalDesc: string;
    eligibility: string;
    eligibilityDesc: string;
    academic: string;
    academicDesc: string;
    documents: string;
    documentsDesc: string;
    review: string;
    reviewDesc: string;
  };
}

const TRANSLATIONS: Record<Language, Translation> = {
  en: {
    title: "Assisted Application Mode",
    subtitle: "Step-by-step assisted guidance ensuring 100% complete submission for low-bandwidth devices.",
    step: "Step",
    of: "of",
    saveResume: "Save & Resume Later",
    draftSaved: "Draft saved locally",
    next: "Continue",
    prev: "Previous Step",
    submit: "Submit Application Now",
    submitting: "Submitting Application...",
    checklistTitle: "Document Readiness Checklist",
    reviewTitle: "Step 5: Review & Submit",
    reviewDesc: "Please verify all declared information before submitting for automated eligibility & OCR scrutiny.",
    declaration: "I declare that the information provided above is true and authentic. I understand false certificates lead to immediate disqualification and legal action.",
    missingFieldsWarning: "Please fill in the following required fields before submitting:",
    fixField: "Fix in Step",
    stepNames: {
      personal: "Step 1: Personal & Contact Information",
      personalDesc: "Enter your official personal identification and contact details.",
      eligibility: "Step 2: Social Category & Demographics",
      eligibilityDesc: "Enter caste verification, age, and income thresholds required by scheme policy.",
      academic: "Step 3: Academic & Institutional Details",
      academicDesc: "Provide details of your enrolled higher education institution and program.",
      documents: "Step 4: Required Documents & Readiness",
      documentsDesc: "Ensure you have clear digital copies of these required certificates before submitting.",
      review: "Step 5: Final Review & Submission",
      reviewDesc: "Verify your entered details. All fields are checked for policy compliance.",
    },
  },
  hi: {
    title: "सहायता प्राप्त आवेदन मोड (Assisted Mode)",
    subtitle: "कम बैंडविड्थ और मोबाइल फोन के लिए विशेष रूप से सरल एवं संपूर्ण चरण-दर-चरण आवेदन।",
    step: "चरण",
    of: "कुल",
    saveResume: "सहेजें और बाद में पूरा करें",
    draftSaved: "प्रारूप सुरक्षित कर लिया गया है",
    next: "आगे बढ़ें",
    prev: "पिछला चरण",
    submit: "आवेदन अभी जमा करें",
    submitting: "आवेदन जमा किया जा रहा है...",
    checklistTitle: "दस्तावेज तैयारी चेकलिस्ट",
    reviewTitle: "चरण 5: समीक्षा एवं अंतिम सबमिशन",
    reviewDesc: "कृपया आवेदन जमा करने से पहले सभी दर्ज विवरणों की दोबारा जांच कर लें।",
    declaration: "मैं घोषणा करता/करती हूँ कि उपरोक्त दी गई सभी जानकारी पूर्णतः सत्य है। किसी भी असत्य जानकारी पर आवेदन निरस्त किया जा सकता है।",
    missingFieldsWarning: "कृपया सबमिट करने से पहले निम्न अनिवार्य फ़ील्ड भरें:",
    fixField: "चरण पर जाएं",
    stepNames: {
      personal: "चरण 1: व्यक्तिगत और संपर्क विवरण",
      personalDesc: "अपना आधिकारिक व्यक्तिगत पहचान और संपर्क विवरण दर्ज करें।",
      eligibility: "चरण 2: सामाजिक श्रेणी और पात्रता",
      eligibilityDesc: "योजना की शर्तों के अनुसार जाति प्रमाण पत्र, आयु और वार्षिक पारिवारिक आय दर्ज करें।",
      academic: "चरण 3: शैक्षणिक एवं संस्थान विवरण",
      academicDesc: "अपने वर्तमान विश्वविद्यालय/संस्थान और पाठ्यक्रम की जानकारी दें।",
      documents: "चरण 4: आवश्यक दस्तावेज चेकलिस्ट",
      documentsDesc: "आवेदन जमा करने से पहले सुनिश्चित करें कि आपके पास इन सभी प्रमाण पत्रों की साफ प्रति है।",
      review: "चरण 5: समीक्षा एवं अंतिम सबमिशन",
      reviewDesc: "अपने दर्ज विवरणों की जांच करें। सभी फ़ील्ड की नियमों के अनुसार जांच की जाएगी।",
    },
  },
};

export function AssistedApplicationMode({
  schemeName,
  schemeCode,
  formFields,
  requiredDocs = [],
  formData,
  onUpdateField,
  onSubmit,
  isSubmitting,
  onClose,
  submitError,
}: AssistedModeProps) {
  const [lang, setLang] = useState<Language>("en");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [declarationChecked, setDeclarationChecked] = useState<boolean>(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

  const t = TRANSLATIONS[lang];

  // Dynamically partition formFields into 3 logical data steps so NO field is ever skipped:
  // Step 1: Personal (name, email, phone, gender, dob, etc.)
  // Step 2: Eligibility & Demographics (category, is_st, age, annual_income, state, district, disability, pvtg, etc.)
  // Step 3: Academic / Institutional (university, institution, qualification, course, percentage, admission, etc.)
  const { personalFields, eligibilityFields, academicFields } = useMemo(() => {
    const personalKeys = new Set([
      "applicant_name", "name", "full_name",
      "applicant_email", "email",
      "applicant_phone", "phone", "mobile",
      "gender", "dob", "date_of_birth", "aadhaar"
    ]);

    const eligibilityKeys = new Set([
      "category", "is_st", "social_category", "sub_caste",
      "age", "annual_income", "family_income", "income",
      "state", "district", "domicile", "domicile_state",
      "disability", "is_disabled", "pwd", "pwd_percentage",
      "vulnerable_group", "pvtg", "minority"
    ]);

    const academicKeys = new Set([
      "university", "institution", "institution_name", "institute", "college",
      "qualification", "highest_qualification", "degree",
      "course", "course_or_degree", "course_level", "department",
      "percentage", "qualifying_marks", "marks", "cgpa", "grade",
      "admission_confirmed", "is_admission_confirmed", "admission_letter",
      "enrollment_number", "roll_number", "passing_year", "year_of_passing"
    ]);

    const pFields: RenderableField[] = [];
    const eFields: RenderableField[] = [];
    const aFields: RenderableField[] = [];

    for (const f of formFields) {
      const k = f.key.toLowerCase();
      if (personalKeys.has(k) || k.startsWith("applicant_")) {
        pFields.push(f);
      } else if (eligibilityKeys.has(k) || k.includes("income") || k.includes("category") || k.includes("caste") || k.includes("age") || k.includes("state") || k.includes("district")) {
        eFields.push(f);
      } else if (academicKeys.has(k) || k.includes("uni") || k.includes("degree") || k.includes("marks") || k.includes("admission") || k.includes("course") || k.includes("percentage") || k.includes("qualification")) {
        aFields.push(f);
      } else {
        // Fallback: put in eligibility if short demographic, else academic
        if (f.type === "number" || f.type === "boolean") {
          eFields.push(f);
        } else {
          aFields.push(f);
        }
      }
    }

    // Ensure we always have primary contact fields represented
    if (pFields.length === 0) {
      pFields.push(
        { key: "applicant_name", label: "Full Name", type: "text", required: true, placeholder: "e.g. Birsa Munda" },
        { key: "applicant_email", label: "Email Address", type: "email", required: true, placeholder: "applicant@example.com" },
        { key: "applicant_phone", label: "Phone Number", type: "text", required: true, placeholder: "9876543210" },
      );
    }

    return { personalFields: pFields, eligibilityFields: eFields, academicFields: aFields };
  }, [formFields]);

  // Find missing required fields across the entire form
  const missingRequiredFields = useMemo(() => {
    const missing: { field: RenderableField; step: number }[] = [];

    const checkField = (f: RenderableField, step: number) => {
      if (!f.required) return;
      const v = formData[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        missing.push({ field: f, step });
      }
    };

    personalFields.forEach((f) => checkField(f, 1));
    eligibilityFields.forEach((f) => checkField(f, 2));
    academicFields.forEach((f) => checkField(f, 3));

    return missing;
  }, [personalFields, eligibilityFields, academicFields, formData]);

  // Save draft to localStorage
  const handleSaveDraft = () => {
    try {
      localStorage.setItem(`ys_draft_${schemeCode}`, JSON.stringify(formData));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save draft:", e);
    }
  };

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ys_draft_${schemeCode}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([k, v]) => {
          if (formData[k] === undefined || formData[k] === "") onUpdateField(k, v);
        });
      }
    } catch (e) {}
  }, []);

  const handleNextStep = () => {
    setCurrentStep((s) => Math.min(s + 1, 5));
  };

  const handlePrevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  };

  // Render a dynamic form field input cleanly
  const renderFieldInput = (f: RenderableField) => {
    const val = formData[f.key] ?? "";

    if (f.type === "select" && f.options && f.options.length > 0) {
      return (
        <select
          value={String(val)}
          onChange={(e) => onUpdateField(f.key, e.target.value)}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36] bg-white text-stone-900"
        >
          <option value="">-- Select {f.label} --</option>
          {f.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (f.type === "boolean") {
      return (
        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-stone-200 bg-stone-50 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => onUpdateField(f.key, e.target.checked)}
            className="w-4 h-4 text-[#de5c36] rounded"
          />
          <span className="text-xs font-semibold text-stone-800">
            {val ? "Yes / Confirmed" : "No / Not Applicable"}
          </span>
        </label>
      );
    }

    if (f.type === "textarea") {
      return (
        <textarea
          rows={3}
          value={String(val)}
          onChange={(e) => onUpdateField(f.key, e.target.value)}
          placeholder={f.placeholder || `Enter ${f.label}`}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
        />
      );
    }

    return (
      <input
        type={f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}
        step={f.type === "number" ? "any" : undefined}
        value={val}
        onChange={(e) => {
          const v = e.target.value;
          if (f.type === "number") {
            onUpdateField(f.key, v === "" ? "" : Number(v));
          } else {
            onUpdateField(f.key, v);
          }
        }}
        placeholder={f.placeholder || `e.g. ${f.label}`}
        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
      />
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-900 to-stone-850 p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-[#de5c36] text-white px-2 py-0.5 rounded font-black text-[10px] uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> {t.title}
              </span>
              <span className="font-mono text-xs text-stone-300">({schemeCode})</span>
            </div>
            <p className="text-xs text-stone-300">{t.subtitle}</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Selector */}
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "hi" : "en")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold border border-stone-700 transition"
            >
              <Globe2 className="w-3.5 h-3.5" />
              {lang === "en" ? "हिन्दी" : "English"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-stone-100 border-b border-stone-200 px-5 py-2.5 flex items-center justify-between text-xs">
          <span className="font-bold text-stone-700">
            {t.step} {currentStep} {t.of} 5
          </span>
          <div className="w-1/2 bg-stone-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#de5c36] h-full transition-all duration-300"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 hover:text-[#de5c36] transition"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaved ? t.draftSaved : t.saveResume}
          </button>
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* STEP 1: Personal Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.stepNames.personal}</h3>
                <p className="text-stone-600">{t.stepNames.personalDesc}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {personalFields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="font-bold text-stone-800 block mb-1">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    {renderFieldInput(f)}
                    {f.helpText && <span className="text-[10px] text-stone-500 block mt-0.5">{f.helpText}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2: Eligibility & Demographics */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.stepNames.eligibility}</h3>
                <p className="text-stone-600">{t.stepNames.eligibilityDesc}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {eligibilityFields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="font-bold text-stone-800 block mb-1">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    {renderFieldInput(f)}
                    {f.helpText && <span className="text-[10px] text-stone-500 block mt-0.5">{f.helpText}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Academic / Institutional */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.stepNames.academic}</h3>
                <p className="text-stone-600">{t.stepNames.academicDesc}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {academicFields.map((f) => (
                  <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                    <label className="font-bold text-stone-800 block mb-1">
                      {f.label} {f.required && <span className="text-rose-500">*</span>}
                    </label>
                    {renderFieldInput(f)}
                    {f.helpText && <span className="text-[10px] text-stone-500 block mt-0.5">{f.helpText}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Documents Checklist */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.stepNames.documents}</h3>
                <p className="text-stone-600">{t.stepNames.documentsDesc}</p>
              </div>

              <div className="space-y-2.5">
                {requiredDocs.length > 0 ? (
                  requiredDocs.map((doc, idx) => (
                    <div key={doc.doc_type || idx} className="bg-white p-3.5 rounded-xl border border-stone-200 space-y-1">
                      <div className="font-bold text-stone-900 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          {idx + 1}. {doc.label || doc.doc_type}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${doc.required !== false ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-stone-100 text-stone-600 border-stone-200"}`}>
                          {doc.required !== false ? "Required" : "Optional"}
                        </span>
                      </div>
                      {doc.description && <p className="text-[11px] text-stone-600 ml-5">{doc.description}</p>}
                      {doc.accepted_formats && (
                        <p className="text-[10px] text-stone-400 ml-5 font-mono">
                          Formats: {doc.accepted_formats.join(", ").toUpperCase()}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="bg-white p-4 rounded-xl border border-stone-200 text-stone-600">
                    <p>Standard documents required: Caste Certificate (ST), Current Year Income Proof, University Enrollment/Admission Confirmation.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.reviewTitle}</h3>
                <p className="text-stone-600">{t.reviewDesc}</p>
              </div>

              {/* Incomplete Fields Warning */}
              {missingRequiredFields.length > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    {t.missingFieldsWarning}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingRequiredFields.map(({ field, step }) => (
                      <button
                        key={field.key}
                        type="button"
                        onClick={() => setCurrentStep(step)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-rose-300 rounded text-[11px] font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
                      >
                        {field.label} &rarr; <span className="underline">{t.fixField} {step}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Declaration Overview */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-3">
                <h4 className="font-bold text-stone-800 text-xs uppercase tracking-wide border-b border-stone-100 pb-2">
                  Declared Application Values
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {formFields.map((f) => {
                    const val = formData[f.key];
                    const hasVal = val !== undefined && val !== null && String(val).trim() !== "";
                    return (
                      <div key={f.key} className="p-2 rounded bg-stone-50 border border-stone-100">
                        <span className="text-stone-500 block text-[10px] font-semibold uppercase">{f.label}</span>
                        <span className={`font-bold block truncate ${hasVal ? "text-stone-900" : "text-rose-500 italic"}`}>
                          {hasVal ? (typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)) : "Not Provided"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Legal Declaration */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-stone-300 bg-stone-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#de5c36] rounded"
                />
                <span className="text-[11px] text-stone-700 leading-relaxed font-medium">
                  {t.declaration}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="bg-stone-50 border-t border-stone-200 p-4 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {t.prev}
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNextStep}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#de5c36] hover:bg-[#c4502f] text-white text-xs font-bold transition shadow-sm"
            >
              {t.next}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !declarationChecked || missingRequiredFields.length > 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t.submitting : t.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
