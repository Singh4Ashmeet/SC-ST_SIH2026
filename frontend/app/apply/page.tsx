"use client";

import React from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  getSchemes,
  type SchemeRead,
} from "@/lib/api";
import {
  FileText,
  ClipboardList,
  ArrowRight,
  Shield,
  Users,
  Globe,
  Award,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

const schemeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  NFST: Award,
  NOS: Globe,
};

const schemeDescriptions: Record<string, string> = {
  NFST: "For Scheduled Tribe candidates pursuing M.Phil/Ph.D research in Indian universities",
  NOS: "For SC/ST/DNT candidates studying abroad at Masters/PhD level",
};

function SchemeIcon({ code, className }: { code: string; className?: string }) {
  const Icon = schemeIcons[code] || Award;
  return <Icon className={className} />;
}

export default function ApplyLandingPage() {
  const { data: schemes, isLoading, error } = useSWR<SchemeRead[]>(
    "/api/schemes?is_active=true",
    () => getSchemes(true)
  );

  const activeSchemes = schemes?.filter((s) => s.is_active) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">Available Scholarship Schemes</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Browse active scholarship and fellowship programs. Select a scheme to view details and start your application.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <SchemeCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Unable to load schemes</h2>
        <p className="text-slate-600 mb-6">Please check your connection and try again.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 sm:space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm font-medium">
          <Award className="w-4 h-4" />
          <span>Government of India Scholarship Portal</span>
        </div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight">
          Find Your Scholarship
        </h1>
        <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
          Explore active fellowship and scholarship schemes for SC/ST candidates.
          Apply online, upload documents, and track your application status — all in one place.
        </p>
      </div>

      <Separator className="border-slate-200" />

      {/* Schemes Grid */}
      {activeSchemes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeSchemes.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No active schemes available</h2>
          <p className="text-slate-600">Please check back later for new scholarship opportunities.</p>
        </div>
      )}

      {/* Footer Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-slate-200">
        <InfoCard
          icon={Shield}
          title="Secure & Transparent"
          description="Your data is protected with government-grade security. All processes are auditable and tamper-evident."
        />
        <InfoCard
          icon={Users}
          title="Dedicated Support"
          description="Help desk available for application queries. Multilingual support for regional languages."
        />
        <InfoCard
          icon={BookOpen}
          title="Real-time Tracking"
          description="Track your application status at every stage — from submission to final decision."
        />
      </div>
    </div>
  );
}

function SchemeCard({ scheme }: { scheme: SchemeRead }) {
  const config = scheme.config;
  const requiredDocs = config?.required_documents ?? [];
  const eligibilityRules = config?.eligibility_rules ?? [];

  return (
    <Card className="bg-white border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md">
              <SchemeIcon code={scheme.code} className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {scheme.code}
                </span>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  Active
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 mt-1">{scheme.name}</CardTitle>
            </div>
          </div>
        </div>
        <CardDescription className="text-slate-600 mt-2">
          {scheme.description || schemeDescriptions[scheme.code] || "Scholarship scheme for eligible candidates."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Eligibility Highlights */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            Key Eligibility Criteria
          </div>
          <div className="flex flex-wrap gap-2">
            {eligibilityRules.slice(0, 3).map((rule, idx) => (
              <Badge key={idx} variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs px-2 py-1">
                {formatFieldName(rule.field)}
              </Badge>
            ))}
            {eligibilityRules.length > 3 && (
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs px-2 py-1">
                +{eligibilityRules.length - 3} more
              </Badge>
            )}
          </div>
        </div>

        {/* Required Documents */}
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
            <FileText className="w-4 h-4 text-indigo-600" />
            Required Documents ({requiredDocs.filter((d) => d.required).length})
          </div>
          <ul className="space-y-1.5">
            {requiredDocs.slice(0, 4).map((doc) => (
              <li key={doc.doc_type} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                <span className="truncate">{doc.label}</span>
                {doc.required && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] px-1.5 py-0.5">
                    Required
                  </Badge>
                )}
              </li>
            ))}
            {requiredDocs.length > 4 && (
              <li className="text-sm text-indigo-600 font-medium">
                +{requiredDocs.length - 4} more documents...
              </li>
            )}
          </ul>
        </div>

        <Separator className="border-slate-200" />

        {/* Apply Button */}
        <Link href={`/apply/${scheme.id}`}>
          <Button
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white shadow-md shadow-indigo-600/25 py-3"
            size="lg"
          >
            <span className="font-medium">Start Application</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function SchemeCardSkeleton() {
  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl bg-slate-200" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20 bg-slate-200" />
              <Skeleton className="h-6 w-40 bg-slate-200" />
            </div>
          </div>
        </div>
        <Skeleton className="h-4 w-3/4 bg-slate-200 mt-2" />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3 bg-slate-200" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20 bg-slate-200 rounded-full" />
            <Skeleton className="h-6 w-20 bg-slate-200 rounded-full" />
            <Skeleton className="h-6 w-20 bg-slate-200 rounded-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/3 bg-slate-200" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-full bg-slate-200" />
            <Skeleton className="h-5 w-full bg-slate-200" />
            <Skeleton className="h-5 w-full bg-slate-200" />
          </div>
        </div>
        <Skeleton className="h-10 w-full bg-slate-200 rounded-lg" />
      </CardContent>
    </Card>
  );
}

function InfoCard({ icon: Icon, title, description }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <div className="text-center p-4">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-6 h-6 text-indigo-600" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}

function formatFieldName(field: string): string {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}