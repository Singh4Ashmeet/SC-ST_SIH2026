"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { DecisionPassportView } from "@/components/decision-passport-view";

export default function ApplicantDecisionPassportPage() {
  const params = useParams();
  const applicationId = params?.applicationId as string;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          href={`/apply/status/${applicationId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Application Status
        </Link>
        <span className="text-[11px] text-stone-500 font-mono">
          Transparency & Explainability Record
        </span>
      </div>

      <DecisionPassportView applicationId={applicationId} />
    </div>
  );
}
