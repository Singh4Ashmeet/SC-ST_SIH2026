import Link from "next/link";
import { ArrowRight, FileCheck2, Users, Award } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf8f5] via-[#f5ede3] to-[#eddcd0] relative overflow-hidden">
      {/* Ambient */}
      <div className="absolute top-20 right-20 w-80 h-80 bg-[#de5c36]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-40 left-20 w-80 h-80 bg-[#105a8b]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/yojana-setu-logo.png"
              alt="Yojana Setu"
              className="h-11 w-auto object-contain"
            />
            <div className="hidden sm:flex items-center gap-2.5 border-l border-gray-300 pl-3">
              <img
                src="/ashoka-emblem.png"
                alt="State Emblem of India"
                className="h-10 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider leading-none">
                  Govt. of India
                </span>
                <span className="text-[11px] text-gray-800 font-bold uppercase tracking-wider leading-tight">
                  Ministry of Tribal Affairs
                </span>
              </div>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/apply" className="text-xs font-medium text-gray-600 hover:text-gray-900 transition">Apply</Link>
          <Link href="/login" className="px-4 py-2 text-xs font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition">Admin Login</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-20">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center">
          {/* LARGE LOGO CENTERED JUST ABOVE THE TAGLINE */}
          <div className="mb-6 flex justify-center">
            <img
              src="/yojana-setu-logo.png"
              alt="Yojana Setu Logo"
              className="h-36 sm:h-44 md:h-52 w-auto object-contain drop-shadow-md"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/70 border border-gray-200 rounded-full text-[11px] font-medium text-gray-600 mb-4">
            <Award className="w-3 h-3 text-[#de5c36]" /> SIH 2026 — Smart India Hackathon
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight text-center">
            AI-Driven Scholarship <br /><span className="text-[#de5c36]">Verification</span> &amp; <span className="text-[#105a8b]">Scrutiny</span>
          </h1>
          <p className="text-sm text-gray-600 mt-4 max-w-2xl mx-auto leading-relaxed text-center">
            A technology-driven platform for the Ministry of Tribal Affairs to process, verify, and disburse
            scholarships &amp; fellowships to Scheduled Tribe students across India with transparency and accuracy.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link href="/apply" className="px-5 py-2.5 text-sm font-semibold bg-[#de5c36] hover:bg-[#c4502f] text-white rounded-lg shadow-sm transition flex items-center gap-2">
              Apply for Scholarship <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="px-5 py-2.5 text-sm font-medium bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition">
              Admin Portal
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: FileCheck2, title: "AI Document Scrutiny", desc: "OCR-powered verification of caste certificates, income proofs, and academic records with automated deficiency detection.", color: "text-amber-600", bg: "bg-amber-50" },
            { icon: Users, title: "Cross Scheme Check", desc: "Intelligent deduplication across multiple scholarship programs using Aadhaar-based matching to prevent double benefits.", color: "text-[#105a8b]", bg: "bg-blue-50" },
            { icon: Award, title: "Post-Selection Tracking", desc: "End-to-end management from selection to fund disbursement with renewal tracking and progress monitoring.", color: "text-emerald-600", bg: "bg-emerald-50" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white/80 backdrop-blur-sm rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
                <div className={`w-10 h-10 rounded-full ${f.bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-5 h-5 ${f.color}`} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">{f.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>


      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-200/60 bg-white/40 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-gray-600 font-medium">
            <img
              src="/ashoka-emblem.png"
              alt="State Emblem of India"
              className="h-5 w-auto object-contain"
            />
            <span>Ministry of Tribal Affairs — Government of India</span>
          </div>
          <p className="text-[11px] text-gray-400">Transparency • Accuracy • Empowerment</p>
        </div>
      </footer>
    </div>
  );
}
