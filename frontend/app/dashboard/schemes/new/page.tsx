"use client";

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createScheme,
  validateConfig,
  type ValidateConfigResponse,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  ShieldCheck,
  Trash2,
  Sparkles,
  Settings2,
  FileText,
  GitBranch,
  Clock,
  Shield,
  Award,
  Zap,
  Eye,
  Code,
  Layers,
  Wand2,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */

interface FormFieldItem {
  id: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "multiselect" | "boolean" | "textarea" | "email";
  required: boolean;
  placeholder: string;
  help_text: string;
  options: string;
}

interface EligibilityRuleItem {
  id: string;
  field: string;
  operator: string;
  value: string;
  failure_message: string;
}

interface DocumentItem {
  id: string;
  doc_type: string;
  label: string;
  required: boolean;
  accepted_formats: string[];
}

interface MeritCriterionItem {
  id: string;
  name: string;
  field: string;
  weight: number;
  max_score: number;
  description: string;
}

interface WorkflowStateItem {
  id: string;
  name: string;
  label: string;
  is_terminal: boolean;
}

interface WorkflowTransitionItem {
  id: string;
  from_state: string;
  to_state: string;
  trigger: string;
  allowed_roles: string[];
}

interface SLARuleItem {
  id: string;
  stage: string;
  duration_hours: number;
  warning_hours: number;
  escalation_role: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 9);

const FIELD_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email Address" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown Select" },
  { value: "boolean", label: "Yes / No (Boolean)" },
  { value: "textarea", label: "Multi-line Textarea" },
];

const OPERATORS = [
  { value: "<=", label: "≤ Less than or equal" },
  { value: ">=", label: "≥ Greater than or equal" },
  { value: "==", label: "= Equal to" },
  { value: "!=", label: "≠ Not equal to" },
  { value: "<", label: "< Less than" },
  { value: ">", label: "> Greater than" },
  { value: "in", label: "∈ In list" },
];

const ROLES = [
  "SUPER_ADMIN",
  "SCHEME_ADMIN",
  "SCRUTINY_OFFICER",
  "SELECTION_COMMITTEE",
  "INSTITUTE_VERIFIER",
  "NODAL_OFFICER",
];

const DOC_FORMATS = ["pdf", "jpg", "png", "jpeg"];

const DEFAULT_STATES: WorkflowStateItem[] = [
  { id: uid(), name: "submitted", label: "Application Submitted", is_terminal: false },
  { id: uid(), name: "eligibility_check", label: "Eligibility Verification", is_terminal: false },
  { id: uid(), name: "document_scrutiny", label: "Document Scrutiny", is_terminal: false },
  { id: uid(), name: "deficient", label: "Document Correction Required", is_terminal: false },
  { id: uid(), name: "selection", label: "Selection Committee Review", is_terminal: false },
  { id: uid(), name: "approved", label: "Award Approved", is_terminal: false },
  { id: uid(), name: "disbursed", label: "Disbursed", is_terminal: true },
  { id: uid(), name: "rejected", label: "Rejected", is_terminal: true },
];

const DEFAULT_TRANSITIONS: WorkflowTransitionItem[] = [
  { id: uid(), from_state: "submitted", to_state: "eligibility_check", trigger: "auto_evaluate", allowed_roles: [] },
  { id: uid(), from_state: "eligibility_check", to_state: "document_scrutiny", trigger: "eligibility_passed", allowed_roles: [] },
  { id: uid(), from_state: "eligibility_check", to_state: "rejected", trigger: "eligibility_failed", allowed_roles: [] },
  { id: uid(), from_state: "document_scrutiny", to_state: "selection", trigger: "documents_verified", allowed_roles: ["SCRUTINY_OFFICER", "SUPER_ADMIN"] },
  { id: uid(), from_state: "document_scrutiny", to_state: "deficient", trigger: "documents_flagged_deficient", allowed_roles: ["SCRUTINY_OFFICER", "SUPER_ADMIN"] },
  { id: uid(), from_state: "deficient", to_state: "document_scrutiny", trigger: "resubmitted", allowed_roles: [] },
  { id: uid(), from_state: "selection", to_state: "approved", trigger: "committee_approved", allowed_roles: ["SELECTION_COMMITTEE", "SUPER_ADMIN"] },
  { id: uid(), from_state: "selection", to_state: "rejected", trigger: "committee_rejected", allowed_roles: ["SELECTION_COMMITTEE", "SUPER_ADMIN"] },
  { id: uid(), from_state: "approved", to_state: "disbursed", trigger: "disbursed", allowed_roles: ["SCHEME_ADMIN", "SUPER_ADMIN"] },
];

/* ─── Reusable UI Components ─────────────────────────────────────── */

function SectionHeader({ icon: Icon, title, count, color }: { icon: any; title: string; count?: number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {count !== undefined && (
        <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, required, type = "text", className = "" }: any) {
  return (
    <div className={className}>
      <label className="text-[11px] text-gray-500 font-medium block mb-1">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] bg-white transition"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, className = "" }: any) {
  return (
    <div className={className}>
      <label className="text-[11px] text-gray-500 font-medium block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] bg-white transition"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition" title="Remove">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#de5c36] bg-[#de5c36]/5 hover:bg-[#de5c36]/10 border border-[#de5c36]/20 rounded-lg transition"
    >
      <Plus className="w-3 h-3" /> {label}
    </button>
  );
}

/* ─── Main Page Component ────────────────────────────────────────── */

export default function NewSchemePage() {
  const router = useRouter();

  // Basic info
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Config sections
  const [formFields, setFormFields] = useState<FormFieldItem[]>([
    { id: uid(), key: "applicant_name", label: "Full Name", type: "text", required: true, placeholder: "As per official certificates", help_text: "Official full name", options: "" },
    { id: uid(), key: "applicant_email", label: "Email Address", type: "email", required: true, placeholder: "applicant@example.com", help_text: "Official alerts sent here", options: "" },
    { id: uid(), key: "applicant_phone", label: "Mobile Number", type: "text", required: true, placeholder: "+91-9876543210", help_text: "10-digit mobile phone number", options: "" },
    { id: uid(), key: "age", label: "Applicant Age", type: "number", required: true, placeholder: "e.g. 26", help_text: "Age in completed years", options: "" },
    { id: uid(), key: "annual_income", label: "Annual Family Income", type: "number", required: true, placeholder: "e.g. 480000", help_text: "Revenue certificate amount (INR)", options: "" },
    { id: uid(), key: "category", label: "Social Category", type: "select", required: true, placeholder: "Select category", help_text: "Affirmative action category", options: "ST, SC, OBC, GEN" },
  ]);

  const [eligibilityRules, setEligibilityRules] = useState<EligibilityRuleItem[]>([
    { id: uid(), field: "category", operator: "==", value: "ST", failure_message: "Candidate must belong to Scheduled Tribe (ST) category" },
    { id: uid(), field: "annual_income", operator: "<=", value: "600000", failure_message: "Family income must not exceed INR 6,00,000 per annum" },
    { id: uid(), field: "age", operator: "<=", value: "36", failure_message: "Applicant age must be 36 years or below" },
  ]);

  const [documents, setDocuments] = useState<DocumentItem[]>([
    { id: uid(), doc_type: "caste_certificate", label: "Caste / Tribe Certificate", required: true, accepted_formats: ["pdf", "jpg", "png"] },
    { id: uid(), doc_type: "income_certificate", label: "Annual Income Certificate", required: true, accepted_formats: ["pdf"] },
  ]);

  const [meritCriteria, setMeritCriteria] = useState<MeritCriterionItem[]>([]);
  const [workflowStates, setWorkflowStates] = useState<WorkflowStateItem[]>(DEFAULT_STATES);
  const [transitions, setTransitions] = useState<WorkflowTransitionItem[]>(DEFAULT_TRANSITIONS);
  const [slaRules, setSlaRules] = useState<SLARuleItem[]>([]);
  const [initialState, setInitialState] = useState("submitted");

  // UI state
  const [activeTab, setActiveTab] = useState<string>("form");
  const [validationResult, setValidationResult] = useState<ValidateConfigResponse | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  const totalWeight = meritCriteria.reduce((sum, c) => sum + (c.weight || 0), 0);

  // Quick 60-second Demo Preset (Phase 4)
  const loadDemoPreset = () => {
    setCode("HEMF_2026");
    setName("Higher Education Merit Fellowship for ST Students");
    setDescription("Ministry of Tribal Affairs Special Merit Fellowship for Postgraduate ST Scholars");
    setFormFields([
      { id: uid(), key: "applicant_name", label: "Full Name", type: "text", required: true, placeholder: "Full official name", help_text: "As per caste certificate", options: "" },
      { id: uid(), key: "applicant_email", label: "Email Address", type: "email", required: true, placeholder: "scholar@example.com", help_text: "Official email", options: "" },
      { id: uid(), key: "applicant_phone", label: "Mobile Number", type: "text", required: true, placeholder: "+91-9876543210", help_text: "Phone number", options: "" },
      { id: uid(), key: "category", label: "Social Category", type: "select", required: true, placeholder: "", help_text: "ST Category verification", options: "ST" },
      { id: uid(), key: "annual_income", label: "Annual Family Income (INR)", type: "number", required: true, placeholder: "e.g. 500000", help_text: "Max INR 7,50,000", options: "" },
      { id: uid(), key: "graduation_marks", label: "Graduation Aggregate Percentage", type: "number", required: true, placeholder: "e.g. 72.5", help_text: "Minimum 65% aggregate required", options: "" },
      { id: uid(), key: "research_discipline", label: "Research Discipline", type: "select", required: true, placeholder: "", help_text: "Academic field", options: "Science & Technology, Social Sciences, Tribal Studies, Environmental Ecology" },
    ]);
    setEligibilityRules([
      { id: uid(), field: "category", operator: "==", value: "ST", failure_message: "Applicant must belong to Scheduled Tribe (ST) category." },
      { id: uid(), field: "annual_income", operator: "<=", value: "750000", failure_message: "Annual income must not exceed INR 7,50,000." },
      { id: uid(), field: "graduation_marks", operator: ">=", value: "65", failure_message: "Minimum 65% marks required in graduation." },
    ]);
    setDocuments([
      { id: uid(), doc_type: "caste_certificate", label: "Caste / Tribe Certificate", required: true, accepted_formats: ["pdf", "jpg", "png"] },
      { id: uid(), doc_type: "income_certificate", label: "Revenue Income Certificate", required: true, accepted_formats: ["pdf"] },
      { id: uid(), doc_type: "graduation_marksheet", label: "Graduation Final Marksheet", required: true, accepted_formats: ["pdf"] },
    ]);
    setActiveTab("form");
  };

  /* ─── Build Config JSON ──────────────────────────────────────── */

  const buildConfig = useCallback(() => {
    const config: any = {
      scheme_code: code || "DEMO_SCHEME",
      version: 1,
      form_schema: {
        fields: formFields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder || undefined,
          help_text: f.help_text || undefined,
          options: f.options ? f.options.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        })),
      },
      eligibility_rules: eligibilityRules.map((r) => ({
        field: r.field,
        condition:
          r.operator === "in"
            ? { in: [{ var: r.field }, r.value.split(",").map((v) => v.trim())] }
            : { [r.operator]: [{ var: r.field }, isNaN(Number(r.value)) ? r.value : Number(r.value)] },
        failure_message: r.failure_message,
      })),
      required_documents: documents.map((d) => ({
        doc_type: d.doc_type,
        label: d.label,
        required: d.required,
        accepted_formats: d.accepted_formats,
      })),
      workflow_states: workflowStates.map((s) => ({
        name: s.name,
        label: s.label,
        is_terminal: s.is_terminal,
      })),
      workflow_transitions: transitions.map((t) => ({
        from_state: t.from_state,
        to_state: t.to_state,
        trigger: t.trigger,
        allowed_roles: t.allowed_roles,
      })),
      initial_state: initialState,
    };

    if (meritCriteria.length > 0) {
      config.merit_criteria = meritCriteria.map((c) => ({
        name: c.name,
        field: c.field,
        weight: c.weight,
        max_score: c.max_score,
        description: c.description,
      }));
    }

    if (slaRules.length > 0) {
      config.sla_rules = slaRules.map((s) => ({
        stage: s.stage,
        duration_hours: s.duration_hours,
        ...(s.warning_hours ? { warning_hours: s.warning_hours } : {}),
        ...(s.escalation_role ? { escalation_role: s.escalation_role } : {}),
      }));
    }

    return config;
  }, [code, formFields, eligibilityRules, documents, meritCriteria, workflowStates, transitions, initialState, slaRules]);

  /* ─── Actions ────────────────────────────────────────────────── */

  const handleValidate = async () => {
    setValidationResult(null);
    setIsValidating(true);
    try {
      const config = buildConfig();
      const res = await validateConfig(config);
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({ valid: false, errors: [err?.message || "Validation failed"] });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      alert("Please fill in Scheme Code and Scheme Name.");
      return;
    }
    const config = buildConfig();
    setIsSubmitting(true);
    try {
      await createScheme({ code: code.trim(), name: name.trim(), description: description.trim(), config, is_active: true });
      router.push("/dashboard/schemes");
    } catch (err: any) {
      alert(err?.message || "Failed to create scheme");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ─── Tab Config ─────────────────────────────────────────────── */

  const tabs = [
    { key: "form", label: "Dynamic Form Builder", icon: Layers, color: "bg-indigo-600" },
    { key: "eligibility", label: "Eligibility Rules", icon: Shield, color: "bg-blue-600" },
    { key: "documents", label: "Documents", icon: FileText, color: "bg-emerald-600" },
    { key: "merit", label: "Merit Scoring", icon: Award, color: "bg-amber-600" },
    { key: "workflow", label: "Workflow States", icon: GitBranch, color: "bg-violet-600" },
    { key: "sla", label: "SLA Config", icon: Clock, color: "bg-rose-600" },
  ];

  /* ─── Render ─────────────────────────────────────────────────── */

  return (
    <div className="space-y-5 max-w-5xl mx-auto animate-fade-in pb-12">
      <Link href="/dashboard/schemes" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Schemes
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#de5c36]" /> Declarative Scheme Builder
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Define forms, rules, documents, and workflows without code</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadDemoPreset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#de5c36] bg-[#de5c36]/10 hover:bg-[#de5c36]/20 border border-[#de5c36]/30 rounded-lg transition"
          >
            <Wand2 className="w-3.5 h-3.5" /> 60s Demo Preset (HEMF)
          </button>
          <button
            type="button"
            onClick={() => setShowJsonPreview(!showJsonPreview)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            {showJsonPreview ? <Eye className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
            {showJsonPreview ? "Visual View" : "JSON Preview"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Basic Info Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <SectionHeader icon={Settings2} title="Basic Information" color="bg-gray-700" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Scheme Code" value={code} onChange={setCode} placeholder="e.g. HEMF_2026" required />
            <InputField label="Scheme Name" value={name} onChange={setName} placeholder="e.g. Higher Education Merit Fellowship for ST Students" required />
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-medium block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the scholarship scheme..."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#de5c36] h-16 bg-white transition"
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 bg-white rounded-xl border border-gray-200 shadow-sm p-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  isActive ? "text-white bg-[#de5c36] shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.key === "form" && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100"}`}>{formFields.length}</span>}
                {tab.key === "eligibility" && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100"}`}>{eligibilityRules.length}</span>}
                {tab.key === "documents" && <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100"}`}>{documents.length}</span>}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          {/* ─── Dynamic Form Builder Tab ─── */}
          {activeTab === "form" && (
            <div className="space-y-4">
              <SectionHeader icon={Layers} title="Dynamic Application Form Schema" count={formFields.length} color="bg-indigo-600" />
              <p className="text-[11px] text-gray-500 -mt-2">
                Configure the fields dynamically rendered for applicants on the portal. No frontend code changes required.
              </p>

              <div className="space-y-3">
                {formFields.map((field, idx) => (
                  <div key={field.id} className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-200 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        {field.label || `Field ${idx + 1}`}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const updated = [...formFields];
                              updated[idx].required = e.target.checked;
                              setFormFields(updated);
                            }}
                            className="w-3.5 h-3.5 text-[#de5c36] rounded"
                          />
                          Required
                        </label>
                        <RemoveButton onClick={() => setFormFields(formFields.filter((_, i) => i !== idx))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                      <InputField
                        label="Field Key (e.g. annual_income)"
                        value={field.key}
                        onChange={(v: string) => {
                          const updated = [...formFields];
                          updated[idx].key = v;
                          setFormFields(updated);
                        }}
                        placeholder="annual_income"
                      />
                      <InputField
                        label="Display Label"
                        value={field.label}
                        onChange={(v: string) => {
                          const updated = [...formFields];
                          updated[idx].label = v;
                          setFormFields(updated);
                        }}
                        placeholder="Annual Family Income"
                      />
                      <SelectField
                        label="Input Type"
                        value={field.type}
                        onChange={(v: any) => {
                          const updated = [...formFields];
                          updated[idx].type = v;
                          setFormFields(updated);
                        }}
                        options={FIELD_TYPES}
                      />
                      <InputField
                        label="Options (Comma-separated for Select)"
                        value={field.options}
                        onChange={(v: string) => {
                          const updated = [...formFields];
                          updated[idx].options = v;
                          setFormFields(updated);
                        }}
                        placeholder="e.g. ST, SC, OBC, GEN"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <InputField
                        label="Placeholder Text"
                        value={field.placeholder}
                        onChange={(v: string) => {
                          const updated = [...formFields];
                          updated[idx].placeholder = v;
                          setFormFields(updated);
                        }}
                        placeholder="e.g. Enter amount in INR"
                      />
                      <InputField
                        label="Help Text / Guideline"
                        value={field.help_text}
                        onChange={(v: string) => {
                          const updated = [...formFields];
                          updated[idx].help_text = v;
                          setFormFields(updated);
                        }}
                        placeholder="e.g. Must not exceed official ceiling"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <AddButton
                onClick={() =>
                  setFormFields([
                    ...formFields,
                    {
                      id: uid(),
                      key: `custom_field_${formFields.length + 1}`,
                      label: `Custom Field ${formFields.length + 1}`,
                      type: "text",
                      required: true,
                      placeholder: "",
                      help_text: "",
                      options: "",
                    },
                  ])
                }
                label="Add Form Field"
              />
            </div>
          )}

          {/* ─── Eligibility Rules Tab ─── */}
          {activeTab === "eligibility" && (
            <div className="space-y-3">
              <SectionHeader icon={Shield} title="Eligibility Rules" count={eligibilityRules.length} color="bg-blue-600" />
              <p className="text-[11px] text-gray-500 -mt-1">Define conditions that applicants must meet. Evaluated automatically by the engine.</p>
              {eligibilityRules.map((rule, idx) => (
                <div key={rule.id} className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-lg border border-gray-100 animate-fade-in">
                  <span className="text-[10px] font-bold text-gray-400 mt-2 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <InputField
                      label="Field"
                      value={rule.field}
                      onChange={(v: string) => {
                        const updated = [...eligibilityRules];
                        updated[idx] = { ...rule, field: v };
                        setEligibilityRules(updated);
                      }}
                      placeholder="e.g. annual_income"
                    />
                    <SelectField
                      label="Operator"
                      value={rule.operator}
                      onChange={(v: string) => {
                        const updated = [...eligibilityRules];
                        updated[idx] = { ...rule, operator: v };
                        setEligibilityRules(updated);
                      }}
                      options={OPERATORS}
                    />
                    <InputField
                      label="Threshold Value"
                      value={rule.value}
                      onChange={(v: string) => {
                        const updated = [...eligibilityRules];
                        updated[idx] = { ...rule, value: v };
                        setEligibilityRules(updated);
                      }}
                      placeholder="e.g. 600000"
                    />
                    <InputField
                      label="Failure Explanation"
                      value={rule.failure_message}
                      onChange={(v: string) => {
                        const updated = [...eligibilityRules];
                        updated[idx] = { ...rule, failure_message: v };
                        setEligibilityRules(updated);
                      }}
                      placeholder="e.g. Income exceeds INR 6,00,000 limit"
                    />
                  </div>
                  <RemoveButton onClick={() => setEligibilityRules(eligibilityRules.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <AddButton
                onClick={() => setEligibilityRules([...eligibilityRules, { id: uid(), field: "", operator: "==", value: "", failure_message: "" }])}
                label="Add Eligibility Rule"
              />
            </div>
          )}

          {/* ─── Documents Tab ─── */}
          {activeTab === "documents" && (
            <div className="space-y-3">
              <SectionHeader icon={FileText} title="Required Documents" count={documents.length} color="bg-emerald-600" />
              {documents.map((doc, idx) => (
                <div key={doc.id} className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-lg border border-gray-100 animate-fade-in">
                  <span className="text-[10px] font-bold text-gray-400 mt-2 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <InputField
                      label="Document Type Key"
                      value={doc.doc_type}
                      onChange={(v: string) => {
                        const updated = [...documents];
                        updated[idx] = { ...doc, doc_type: v };
                        setDocuments(updated);
                      }}
                      placeholder="e.g. caste_certificate"
                    />
                    <InputField
                      label="Display Label"
                      value={doc.label}
                      onChange={(v: string) => {
                        const updated = [...documents];
                        updated[idx] = { ...doc, label: v };
                        setDocuments(updated);
                      }}
                      placeholder="e.g. Caste Certificate"
                    />
                    <div>
                      <label className="text-[11px] text-gray-500 font-medium block mb-1">Accepted Formats</label>
                      <div className="flex gap-2 flex-wrap">
                        {DOC_FORMATS.map((fmt) => (
                          <label key={fmt} className="flex items-center gap-1 text-[11px] text-gray-600">
                            <input
                              type="checkbox"
                              checked={doc.accepted_formats.includes(fmt)}
                              onChange={(e) => {
                                const updated = [...documents];
                                const fmts = e.target.checked ? [...doc.accepted_formats, fmt] : doc.accepted_formats.filter((f) => f !== fmt);
                                updated[idx] = { ...doc, accepted_formats: fmts };
                                setDocuments(updated);
                              }}
                              className="w-3 h-3 rounded border-gray-300 text-[#de5c36]"
                            />
                            {fmt.toUpperCase()}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <RemoveButton onClick={() => setDocuments(documents.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <AddButton onClick={() => setDocuments([...documents, { id: uid(), doc_type: "", label: "", required: true, accepted_formats: ["pdf"] }])} label="Add Document" />
            </div>
          )}

          {/* ─── Merit Criteria Tab ─── */}
          {activeTab === "merit" && (
            <div className="space-y-3">
              <SectionHeader icon={Award} title="Merit Scoring Criteria" count={meritCriteria.length} color="bg-amber-600" />
              <p className="text-[11px] text-gray-500 -mt-1">Define weighted criteria for ranking applicants. Total weight should sum to 100%.</p>

              {meritCriteria.length > 0 && (
                <div className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-600">Total Weight:</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${totalWeight === 100 ? "bg-emerald-500" : totalWeight > 100 ? "bg-rose-500" : "bg-amber-500"}`}
                      style={{ width: `${Math.min(totalWeight, 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${totalWeight === 100 ? "text-emerald-600" : "text-amber-600"}`}>{totalWeight}%</span>
                </div>
              )}

              {meritCriteria.map((c, idx) => (
                <div key={c.id} className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-lg border border-gray-100 animate-fade-in">
                  <span className="text-[10px] font-bold text-gray-400 mt-2 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <InputField
                      label="Criterion Name"
                      value={c.name}
                      onChange={(v: string) => {
                        const updated = [...meritCriteria];
                        updated[idx] = { ...c, name: v };
                        setMeritCriteria(updated);
                      }}
                      placeholder="e.g. Academic Score"
                    />
                    <InputField
                      label="Field Key"
                      value={c.field}
                      onChange={(v: string) => {
                        const updated = [...meritCriteria];
                        updated[idx] = { ...c, field: v };
                        setMeritCriteria(updated);
                      }}
                      placeholder="e.g. percentage"
                    />
                    <InputField
                      label="Weight (%)"
                      value={c.weight}
                      onChange={(v: number) => {
                        const updated = [...meritCriteria];
                        updated[idx] = { ...c, weight: v };
                        setMeritCriteria(updated);
                      }}
                      type="number"
                      placeholder="40"
                    />
                    <InputField
                      label="Max Score"
                      value={c.max_score}
                      onChange={(v: number) => {
                        const updated = [...meritCriteria];
                        updated[idx] = { ...c, max_score: v };
                        setMeritCriteria(updated);
                      }}
                      type="number"
                      placeholder="100"
                    />
                  </div>
                  <RemoveButton onClick={() => setMeritCriteria(meritCriteria.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <AddButton onClick={() => setMeritCriteria([...meritCriteria, { id: uid(), name: "", field: "", weight: 25, max_score: 100, description: "" }])} label="Add Merit Criterion" />
            </div>
          )}

          {/* ─── Workflow States Tab ─── */}
          {activeTab === "workflow" && (
            <div className="space-y-4">
              <SectionHeader icon={GitBranch} title="Workflow States & Transitions" color="bg-violet-600" />
              <div className="space-y-2">
                {workflowStates.map((st, idx) => (
                  <div key={st.id} className="flex items-center gap-2 p-2 bg-gray-50/80 rounded-lg border border-gray-100 text-xs">
                    <span className="text-[10px] font-bold text-gray-400 w-5 text-center">{idx + 1}</span>
                    <input
                      value={st.name}
                      onChange={(e) => {
                        const updated = [...workflowStates];
                        updated[idx].name = e.target.value;
                        setWorkflowStates(updated);
                      }}
                      className="w-1/3 px-2 py-1 text-xs border rounded bg-white"
                      placeholder="State name"
                    />
                    <input
                      value={st.label}
                      onChange={(e) => {
                        const updated = [...workflowStates];
                        updated[idx].label = e.target.value;
                        setWorkflowStates(updated);
                      }}
                      className="w-1/2 px-2 py-1 text-xs border rounded bg-white"
                      placeholder="Display label"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-gray-600 shrink-0">
                      <input
                        type="checkbox"
                        checked={st.is_terminal}
                        onChange={(e) => {
                          const updated = [...workflowStates];
                          updated[idx].is_terminal = e.target.checked;
                          setWorkflowStates(updated);
                        }}
                        className="w-3 h-3 text-[#de5c36]"
                      />
                      Terminal
                    </label>
                  </div>
                ))}
              </div>

              {/* Transitions */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <SectionHeader icon={Zap} title="Allowed Transitions" count={transitions.length} color="bg-indigo-600" />
                {transitions.map((tr, idx) => (
                  <div key={tr.id} className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-lg border border-gray-100 animate-fade-in">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <SelectField
                        label="From State"
                        value={tr.from_state}
                        onChange={(v: string) => {
                          const updated = [...transitions];
                          updated[idx] = { ...tr, from_state: v };
                          setTransitions(updated);
                        }}
                        options={workflowStates.map((s) => ({ value: s.name, label: s.label || s.name }))}
                      />
                      <SelectField
                        label="To State"
                        value={tr.to_state}
                        onChange={(v: string) => {
                          const updated = [...transitions];
                          updated[idx] = { ...tr, to_state: v };
                          setTransitions(updated);
                        }}
                        options={workflowStates.map((s) => ({ value: s.name, label: s.label || s.name }))}
                      />
                      <InputField
                        label="Trigger Action"
                        value={tr.trigger}
                        onChange={(v: string) => {
                          const updated = [...transitions];
                          updated[idx] = { ...tr, trigger: v };
                          setTransitions(updated);
                        }}
                        placeholder="e.g. approve"
                      />
                      <div>
                        <label className="text-[11px] text-gray-500 font-medium block mb-1">Allowed Roles</label>
                        <div className="flex gap-1 flex-wrap">
                          {ROLES.slice(0, 4).map((role) => (
                            <label key={role} className="flex items-center gap-0.5 text-[10px] text-gray-500">
                              <input
                                type="checkbox"
                                checked={tr.allowed_roles.includes(role)}
                                onChange={(e) => {
                                  const updated = [...transitions];
                                  const roles = e.target.checked
                                    ? [...tr.allowed_roles, role]
                                    : tr.allowed_roles.filter((r) => r !== role);
                                  updated[idx] = { ...tr, allowed_roles: roles };
                                  setTransitions(updated);
                                }}
                                className="w-2.5 h-2.5 rounded border-gray-300 text-[#de5c36]"
                              />
                              {role.replace(/_/g, " ").slice(0, 10)}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <RemoveButton onClick={() => setTransitions(transitions.filter((_, i) => i !== idx))} />
                  </div>
                ))}
                <AddButton
                  onClick={() =>
                    setTransitions([
                      ...transitions,
                      {
                        id: uid(),
                        from_state: workflowStates[0]?.name || "submitted",
                        to_state: workflowStates[1]?.name || "eligibility_check",
                        trigger: "",
                        allowed_roles: [],
                      },
                    ])
                  }
                  label="Add Transition"
                />
              </div>
            </div>
          )}

          {/* ─── SLA Tab ─── */}
          {activeTab === "sla" && (
            <div className="space-y-3">
              <SectionHeader icon={Clock} title="SLA Rules" count={slaRules.length} color="bg-rose-600" />
              <p className="text-[11px] text-gray-500 -mt-1">Define stage processing thresholds and escalation rules.</p>
              {slaRules.map((sla, idx) => (
                <div key={sla.id} className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-lg border border-gray-100 animate-fade-in">
                  <span className="text-[10px] font-bold text-gray-400 mt-2 w-5 text-center">{idx + 1}</span>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2">
                    <SelectField
                      label="Stage"
                      value={sla.stage}
                      onChange={(v: string) => {
                        const updated = [...slaRules];
                        updated[idx] = { ...sla, stage: v };
                        setSlaRules(updated);
                      }}
                      options={workflowStates.filter((s) => !s.is_terminal).map((s) => ({ value: s.name, label: s.label || s.name }))}
                    />
                    <InputField
                      label="Duration (hours)"
                      value={sla.duration_hours}
                      onChange={(v: number) => {
                        const updated = [...slaRules];
                        updated[idx] = { ...sla, duration_hours: v };
                        setSlaRules(updated);
                      }}
                      type="number"
                      placeholder="48"
                    />
                    <InputField
                      label="Warning (hours)"
                      value={sla.warning_hours}
                      onChange={(v: number) => {
                        const updated = [...slaRules];
                        updated[idx] = { ...sla, warning_hours: v };
                        setSlaRules(updated);
                      }}
                      type="number"
                      placeholder="12"
                    />
                    <SelectField
                      label="Escalate To"
                      value={sla.escalation_role}
                      onChange={(v: string) => {
                        const updated = [...slaRules];
                        updated[idx] = { ...sla, escalation_role: v };
                        setSlaRules(updated);
                      }}
                      options={[{ value: "", label: "None" }, ...ROLES.map((r) => ({ value: r, label: r.replace(/_/g, " ") }))]}
                    />
                  </div>
                  <RemoveButton onClick={() => setSlaRules(slaRules.filter((_, i) => i !== idx))} />
                </div>
              ))}
              <AddButton
                onClick={() => setSlaRules([...slaRules, { id: uid(), stage: workflowStates[0]?.name || "submitted", duration_hours: 48, warning_hours: 12, escalation_role: "" }])}
                label="Add SLA Rule"
              />
            </div>
          )}
        </div>

        {/* JSON Preview */}
        {showJsonPreview && (
          <div className="bg-gray-900 rounded-xl p-5 shadow-inner">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-400">Generated Configuration JSON (Declarative Policy)</h4>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(buildConfig(), null, 2));
                }}
                className="text-[10px] font-medium text-amber-400 hover:text-amber-300 transition"
              >
                Copy JSON
              </button>
            </div>
            <pre className="text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-80 overflow-y-auto">
              {JSON.stringify(buildConfig(), null, 2)}
            </pre>
          </div>
        )}

        {/* Validation & Submit */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-[#105a8b] hover:bg-[#0d4b74] text-white rounded-xl shadow-sm transition disabled:opacity-50"
          >
            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            Validate Scheme Policy
          </button>

          {validationResult && (
            <div
              className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border ${
                validationResult.valid
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {validationResult.valid ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" /> Valid Schema & Workflow Integrity Passed
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5" /> {validationResult.errors?.join("; ") || "Invalid"}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3.5 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-xl shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Publishing Scheme to Ministry Portal...
            </>
          ) : (
            <>
              Create & Publish Scheme
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
