"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";

interface AssistedModeProps {
  schemeName: string;
  schemeCode: string;
  formData: Record<string, any>;
  onUpdateField: (key: string, value: any) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onClose: () => void;
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
  acceptableExamples: string;
  steps: {
    personal: {
      title: string;
      desc: string;
      nameLabel: string;
      nameHint: string;
      emailLabel: string;
      phoneLabel: string;
      phoneHint: string;
    };
    category: {
      title: string;
      desc: string;
      stConfirmLabel: string;
      stConfirmDesc: string;
      incomeLabel: string;
      incomeHint: string;
      stateLabel: string;
      districtLabel: string;
    };
    academic: {
      title: string;
      desc: string;
      institutionLabel: string;
      courseLabel: string;
      marksLabel: string;
    };
    documents: {
      title: string;
      desc: string;
      doc1: string;
      doc1Example: string;
      doc2: string;
      doc2Example: string;
      doc3: string;
      doc3Example: string;
    };
    review: {
      title: string;
      desc: string;
      confirmMsg: string;
    };
  };
}

const TRANSLATIONS: Record<Language, Translation> = {
  en: {
    title: "Assisted Application Mode",
    subtitle: "Simplified step-by-step guidance designed for low bandwidth and mobile devices.",
    step: "Step",
    of: "of",
    saveResume: "Save & Resume Later",
    draftSaved: "Draft saved locally on this device",
    next: "Continue",
    prev: "Previous Step",
    submit: "Submit Application Now",
    submitting: "Submitting Application...",
    checklistTitle: "Document Readiness Checklist",
    acceptableExamples: "What is an acceptable document?",
    steps: {
      personal: {
        title: "Step 1: Personal Details",
        desc: "Please enter your name exactly as it appears on your official Scheduled Tribe certificate.",
        nameLabel: "Full Name (as per Certificate)",
        nameHint: "Do not add titles like Shri, Dr, or Mr.",
        emailLabel: "Email Address",
        phoneLabel: "10-Digit Mobile Number",
        phoneHint: "SMS alerts regarding document scrutiny will be sent here.",
      },
      category: {
        title: "Step 2: ST Category & Income Eligibility",
        desc: "Ministry of Tribal Affairs fellowships require verified Scheduled Tribe identity and applicable income limits.",
        stConfirmLabel: "I confirm I belong to a notified Scheduled Tribe (ST)",
        stConfirmDesc: "Official State/Central caste certificate is mandatory.",
        incomeLabel: "Annual Family Income (₹ in numbers)",
        incomeHint: "Enter total family income from all sources (e.g., 250000 for ₹2.5 Lakh).",
        stateLabel: "Domicile State",
        districtLabel: "District of Residence",
      },
      academic: {
        title: "Step 3: Academic & Admission Details",
        desc: "Provide details of your enrolled higher education or research program.",
        institutionLabel: "University / Institute Name",
        courseLabel: "Program of Study (M.Phil / Ph.D / Masters)",
        marksLabel: "Qualifying Degree Marks / CGPA (e.g. 78.5)",
      },
      documents: {
        title: "Step 4: Document Checklist & Guidelines",
        desc: "Ensure you have clear digital copies (PDF or photo) of these required certificates before submitting.",
        doc1: "1. Scheduled Tribe (ST) Certificate",
        doc1Example: "Issued by competent Sub-Divisional Officer (SDO) or District Magistrate with official seal / digital QR code.",
        doc2: "2. Annual Income Certificate",
        doc2Example: "Issued for the current financial year by Circle Officer (CO) or Tehsildar.",
        doc3: "3. Admission Confirmation & University ID",
        doc3Example: "Official admission letter specifying M.Phil/Ph.D registration date and department.",
      },
      review: {
        title: "Step 5: Review & Submit",
        desc: "Please verify all declared information before submitting for automated eligibility & OCR scrutiny.",
        confirmMsg: "I declare that the information provided above is true and authentic. I understand false certificates lead to immediate disqualification and legal action.",
      },
    },
  },
  hi: {
    title: "सहायता प्राप्त आवेदन मोड (Assisted Mode)",
    subtitle: "कम बैंडविड्थ और मोबाइल फोन के लिए विशेष रूप से सरल चरण-दर-चरण आवेदन।",
    step: "चरण",
    of: "कुल",
    saveResume: "सहेजें और बाद में पूरा करें",
    draftSaved: "प्रारूप आपके फोन/कंप्यूटर पर सुरक्षित कर लिया गया है",
    next: "आगे बढ़ें",
    prev: "पिछला चरण",
    submit: "आवेदन अभी जमा करें",
    submitting: "आवेदन जमा किया जा रहा है...",
    checklistTitle: "दस्तावेज तैयारी चेकलिस्ट",
    acceptableExamples: "मान्य दस्तावेज कैसा होना चाहिए?",
    steps: {
      personal: {
        title: "चरण 1: व्यक्तिगत विवरण",
        desc: "कृपया अपना नाम ठीक वैसा ही लिखें जैसा आपके अनुसूचित जनजाति (ST) प्रमाण पत्र पर है।",
        nameLabel: "पूरा नाम (प्रमाण पत्र के अनुसार)",
        nameHint: "श्री, डॉ., या मिस्टर जैसे शीर्षक न लगाएं।",
        emailLabel: "ईमेल पता",
        phoneLabel: "10-अंकों का मोबाइल नंबर",
        phoneHint: "दस्तावेज जांच और स्थिति के एसएमएस इसी नंबर पर भेजे जाएंगे।",
      },
      category: {
        title: "चरण 2: अनुसूचित जनजाति (ST) श्रेणी और आय",
        desc: "जनजातीय कार्य मंत्रालय छात्रवृत्ति के लिए वैध ST प्रमाण पत्र और आय सीमा अनिवार्य है।",
        stConfirmLabel: "मैं पुष्टि करता/करती हूँ कि मैं अनुसूचित जनजाति (ST) वर्ग से हूँ",
        stConfirmDesc: "सक्षम अधिकारी द्वारा जारी प्रमाण पत्र अनिवार्य होगा।",
        incomeLabel: "वार्षिक पारिवारिक आय (रुपये अंकों में)",
        incomeHint: "सभी स्रोतों से कुल वार्षिक आय लिखें (जैसे ₹2,50,000 के लिए 250000)।",
        stateLabel: "निवास का राज्य",
        districtLabel: "गृह जिला",
      },
      academic: {
        title: "चरण 3: शैक्षणिक एवं प्रवेश विवरण",
        desc: "अपने वर्तमान उच्च शिक्षण संस्थान या शोध कार्यक्रम की जानकारी दें।",
        institutionLabel: "विश्वविद्यालय / संस्थान का नाम",
        courseLabel: "अध्ययन का पाठ्यक्रम (एम.फिल / पीएच.डी / मास्टर्स)",
        marksLabel: "पिछली परीक्षा के प्राप्तांक / प्रतिशत (उदा. 75.4)",
      },
      documents: {
        title: "चरण 4: दस्तावेज चेकलिस्ट एवं उदाहरण",
        desc: "आवेदन जमा करने से पहले जांच लें कि आपके पास इन दस्तावेजों की साफ डिजिटल प्रति उपलब्ध है।",
        doc1: "1. अनुसूचित जनजाति (ST) जाति प्रमाण पत्र",
        doc1Example: "अनुमंडल दंडाधिकारी (SDO) या जिला दंडाधिकारी (DM) द्वारा जारी डिजिटल मुहर/क्यूआर कोड सहित।",
        doc2: "2. वार्षिक पारिवारिक आय प्रमाण पत्र",
        doc2Example: "सक्षम अंचलाधिकारी (CO) या तहसीलदार द्वारा चालू वित्तीय वर्ष के लिए जारी।",
        doc3: "3. विश्वविद्यालय प्रवेश पत्र एवं पहचान पत्र",
        doc3Example: "शोध पंजीकरण और विभाग का विवरण दर्शाने वाला आधिकारिक पत्र।",
      },
      review: {
        title: "चरण 5: समीक्षा एवं अंतिम सबमिशन",
        desc: "कृपया आवेदन जमा करने से पहले सभी दर्ज विवरणों की दोबारा जांच कर लें।",
        confirmMsg: "मैं घोषणा करता/करती हूँ कि उपरोक्त दी गई सभी जानकारी पूर्णतः सत्य है। किसी भी असत्य जानकारी पर आवेदन निरस्त किया जा सकता है।",
      },
    },
  },
};

export function AssistedApplicationMode({
  schemeName,
  schemeCode,
  formData,
  onUpdateField,
  onSubmit,
  isSubmitting,
  onClose,
}: AssistedModeProps) {
  const [lang, setLang] = useState<Language>("en");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [declarationChecked, setDeclarationChecked] = useState<boolean>(false);

  const t = TRANSLATIONS[lang];

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

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`ys_draft_${schemeCode}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([k, v]) => {
          if (!formData[k]) onUpdateField(k, v);
        });
      }
    } catch (e) {}
  }, []);

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

        {/* Wizard Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* STEP 1: Personal Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.steps.personal.title}</h3>
                <p className="text-stone-600">{t.steps.personal.desc}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.personal.nameLabel} *</label>
                  <input
                    type="text"
                    value={formData.applicant_name || ""}
                    onChange={(e) => onUpdateField("applicant_name", e.target.value)}
                    placeholder="e.g. Birsa Munda"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">{t.steps.personal.nameHint}</span>
                </div>

                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.personal.emailLabel} *</label>
                  <input
                    type="email"
                    value={formData.applicant_email || ""}
                    onChange={(e) => onUpdateField("applicant_email", e.target.value)}
                    placeholder="birsa@example.com"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.personal.phoneLabel} *</label>
                  <input
                    type="tel"
                    value={formData.applicant_phone || ""}
                    onChange={(e) => onUpdateField("applicant_phone", e.target.value)}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">{t.steps.personal.phoneHint}</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: ST Category & Income */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.steps.category.title}</h3>
                <p className="text-stone-600">{t.steps.category.desc}</p>
              </div>

              <div className="space-y-3">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-300 bg-amber-50/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.category === "ST" || formData.is_st === true}
                    onChange={(e) => {
                      onUpdateField("category", e.target.checked ? "ST" : "");
                      onUpdateField("is_st", e.target.checked);
                    }}
                    className="mt-0.5 w-4 h-4 text-[#de5c36] rounded"
                  />
                  <div>
                    <span className="font-bold text-stone-900 block">{t.steps.category.stConfirmLabel}</span>
                    <span className="text-[10px] text-stone-600">{t.steps.category.stConfirmDesc}</span>
                  </div>
                </label>

                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.category.incomeLabel} *</label>
                  <input
                    type="number"
                    value={formData.annual_income || ""}
                    onChange={(e) => onUpdateField("annual_income", e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 250000"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                  <span className="text-[10px] text-stone-500 block mt-0.5">{t.steps.category.incomeHint}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-stone-800 block mb-1">{t.steps.category.stateLabel} *</label>
                    <input
                      type="text"
                      value={formData.state || ""}
                      onChange={(e) => onUpdateField("state", e.target.value)}
                      placeholder="e.g. Jharkhand"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-stone-800 block mb-1">{t.steps.category.districtLabel} *</label>
                    <input
                      type="text"
                      value={formData.district || ""}
                      onChange={(e) => onUpdateField("district", e.target.value)}
                      placeholder="e.g. Ranchi"
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Academic Details */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.steps.academic.title}</h3>
                <p className="text-stone-600">{t.steps.academic.desc}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.academic.institutionLabel} *</label>
                  <input
                    type="text"
                    value={formData.institution_name || ""}
                    onChange={(e) => onUpdateField("institution_name", e.target.value)}
                    placeholder="e.g. Ranchi University / IIT Delhi"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.academic.courseLabel} *</label>
                  <input
                    type="text"
                    value={formData.course_or_degree || ""}
                    onChange={(e) => onUpdateField("course_or_degree", e.target.value)}
                    placeholder="Ph.D in Tribal Studies"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-800 block mb-1">{t.steps.academic.marksLabel}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.qualifying_marks || ""}
                    onChange={(e) => onUpdateField("qualifying_marks", e.target.value ? Number(e.target.value) : "")}
                    placeholder="78.5"
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#de5c36]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Document Checklist & Guidelines */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.steps.documents.title}</h3>
                <p className="text-stone-600">{t.steps.documents.desc}</p>
              </div>

              <div className="space-y-3">
                <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {t.steps.documents.doc1}
                  </div>
                  <p className="text-[11px] text-stone-600 ml-5">{t.steps.documents.doc1Example}</p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {t.steps.documents.doc2}
                  </div>
                  <p className="text-[11px] text-stone-600 ml-5">{t.steps.documents.doc2Example}</p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                  <div className="font-bold text-stone-900 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {t.steps.documents.doc3}
                  </div>
                  <p className="text-[11px] text-stone-600 ml-5">{t.steps.documents.doc3Example}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 space-y-1">
                <h3 className="font-bold text-stone-900 text-sm">{t.steps.review.title}</h3>
                <p className="text-stone-600">{t.steps.review.desc}</p>
              </div>

              <div className="bg-white rounded-lg border border-stone-200 p-3.5 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase">Applicant Name:</span>
                    <span className="font-bold text-stone-900">{formData.applicant_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase">Declared Category:</span>
                    <span className="font-bold text-stone-900">{formData.category || "ST"}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase">Annual Income:</span>
                    <span className="font-bold text-stone-900">₹{Number(formData.annual_income || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[10px] uppercase">State / District:</span>
                    <span className="font-bold text-stone-900">{formData.district || "N/A"}, {formData.state || "N/A"}</span>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-stone-300 bg-stone-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-[#de5c36] rounded"
                />
                <span className="text-[11px] text-stone-700 leading-relaxed font-medium">
                  {t.steps.review.confirmMsg}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="bg-stone-50 border-t border-stone-200 p-4 flex items-center justify-between">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s - 1)}
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
              onClick={() => setCurrentStep((s) => s + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#de5c36] hover:bg-[#c4502f] text-white text-xs font-bold transition shadow-sm"
            >
              {t.next}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !declarationChecked}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? t.submitting : t.submit}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
