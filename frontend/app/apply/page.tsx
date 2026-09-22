"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import { getSchemes, type SchemeRead } from "@/lib/api";
import { FileText, ArrowRight, Award, Globe, BookOpen } from "lucide-react";

const schemeIcons: Record<string, React.ComponentType<{ className?: string }>> = { NFST: Award, NOS: Globe };
const schemeDescriptions: Record<string, string> = {
  NFST: "For Scheduled Tribe candidates pursuing M.Phil/Ph.D research in Indian universities",
  NOS: "For SC/ST/DNT candidates studying abroad at Masters/PhD level",
};

function SchemeIcon({ code, className }: { code: string; className?: string }) {
  const Icon = schemeIcons[code] || BookOpen;
  return <Icon className={className} />;
}

export default function ApplyPage() {
  const { data: schemes, isLoading } = useSWR<SchemeRead[]>("/api/schemes", () => getSchemes());
  const activeSchemes = schemes?.filter((s) => s.is_active) || [];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#de5c36]/10 rounded-full text-[11px] font-medium text-[#de5c36]">
          <Award className="w-3 h-3" /> Ministry of Tribal Affairs
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
          Scholarship &amp; Fellowship Schemes
        </h1>
        <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
          Apply online for financial assistance provided by the Ministry of Tribal Affairs for higher education and research programmes in India and abroad.
        </p>
      </div>

      {/* Scheme Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-6 h-6 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" /></div>
      ) : activeSchemes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium">No active schemes available at this time.</p>
          <p className="text-xs mt-1">Please check back later or contact the Ministry of Tribal Affairs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {activeSchemes.map((scheme) => (
            <div key={scheme.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#de5c36]/10 flex items-center justify-center">
                    <SchemeIcon code={scheme.code} className="w-5 h-5 text-[#de5c36]" />
                  </div>
                  <div>
                    <span className="font-mono text-[10px] font-bold text-[#de5c36] bg-[#de5c36]/5 px-1.5 py-0.5 rounded">{scheme.code}</span>
                  </div>
                </div>
                <h3 className="text-base font-bold text-gray-900">{scheme.name}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{scheme.description || schemeDescriptions[scheme.code] || "Financial assistance for eligible students."}</p>

                {/* Required Documents Preview */}
                {scheme.config?.required_documents && scheme.config.required_documents.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Required Documents</div>
                    <div className="flex flex-wrap gap-1.5">
                      {scheme.config.required_documents.slice(0, 4).map((doc: any) => (
                        <span key={doc.doc_type} className="px-2 py-0.5 text-[10px] font-medium bg-gray-50 border border-gray-200 rounded text-gray-600">{doc.label || doc.doc_type}</span>
                      ))}
                      {scheme.config.required_documents.length > 4 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium text-gray-400">+{scheme.config.required_documents.length - 4} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Link href={`/apply/${scheme.id}`}
                className="mt-4 w-full py-2.5 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition flex items-center justify-center gap-2">
                Apply Now <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-r from-[#e7d8c6] via-[#dfccb7] to-[#d6bc9f] rounded-xl p-5 border border-[#cfbfa9]">
        <h3 className="text-sm font-bold text-gray-900 mb-2">How to Apply</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-700">
          <div className="flex items-start gap-2"><span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#de5c36] font-bold text-xs flex-shrink-0">1</span><p>Select an eligible scheme and fill in your personal and academic details.</p></div>
          <div className="flex items-start gap-2"><span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#de5c36] font-bold text-xs flex-shrink-0">2</span><p>Upload required documents (caste certificate, income certificate, etc.)</p></div>
          <div className="flex items-start gap-2"><span className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#de5c36] font-bold text-xs flex-shrink-0">3</span><p>Track your application status and respond to any deficiency notices.</p></div>
        </div>
      </div>
    </div>
  );
}