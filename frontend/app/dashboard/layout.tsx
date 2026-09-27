"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutGrid,
  FileCheck2,
  Sparkles,
  Cpu,
  FileText,
  Search,
  Bell,
  UserCheck,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Award,
  Shield,
  MessageSquareWarning,
  Sliders,
  Briefcase,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact: boolean;
  roles?: string[];
}

interface NavSection {
  category: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    category: "MAIN",
    items: [
      {
        label: "Home Dashboard",
        href: "/dashboard",
        icon: LayoutGrid,
        exact: true,
      },
    ],
  },
  {
    category: "MY WORK",
    items: [
      {
        label: "Scrutiny Queue",
        href: "/dashboard/scrutiny",
        icon: Cpu,
        exact: false,
        roles: ["SUPER_ADMIN", "SCRUTINY_OFFICER"],
      },
      {
        label: "Selection Queue",
        href: "/dashboard/selection",
        icon: Award,
        exact: false,
        roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"],
      },
      {
        label: "Institute Queue",
        href: "/dashboard/applications?queue=institute",
        icon: UserCheck,
        exact: false,
        roles: ["SUPER_ADMIN", "INSTITUTE_VERIFIER", "NODAL_OFFICER"],
      },
    ],
  },
  {
    category: "APPLICATIONS",
    items: [
      {
        label: "All Applications",
        href: "/dashboard/applications",
        icon: FileCheck2,
        exact: false,
      },
    ],
  },
  {
    category: "INTELLIGENCE",
    items: [
      {
        label: "Conflict Detection",
        href: "/dashboard/conflicts",
        icon: Shield,
        exact: false,
        roles: ["SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER"],
      },
    ],
  },
  {
    category: "SCHEMES & SIMULATION",
    items: [
      {
        label: "Scheme Rule Studio",
        href: "/dashboard/schemes",
        icon: Sparkles,
        exact: false,
        roles: ["SUPER_ADMIN", "SCHEME_ADMIN"],
      },
      {
        label: "Policy Simulator",
        href: "/dashboard/simulation",
        icon: Sliders,
        exact: false,
        roles: ["SUPER_ADMIN", "SCHEME_ADMIN"],
      },
    ],
  },
  {
    category: "GOVERNANCE",
    items: [
      {
        label: "Grievances",
        href: "/dashboard/grievances",
        icon: MessageSquareWarning,
        exact: false,
      },
      {
        label: "Audit Trail",
        href: "/dashboard/audit",
        icon: FileText,
        exact: false,
      },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center text-gray-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#de5c36] border-t-transparent animate-spin" />
          <span>Loading administrative portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const userInitials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email.slice(0, 2).toUpperCase();

  const roleLabel = user.role ? user.role.replace(/_/g, " ") : "OFFICER";

  return (
    <div className="min-h-screen bg-[#f5f3ef] text-gray-800 flex flex-row overflow-x-hidden font-sans antialiased">
      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Left Sidebar ── */}
      <aside
        className={`fixed md:sticky top-0 z-40 w-64 bg-[#2f3136] text-gray-300 flex-shrink-0 flex flex-col justify-between min-h-screen shadow-xl transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="relative z-10 flex-1 overflow-y-auto pb-6">
          {/* Portal Brand — Only Slightly Big Yojana Setu Logo */}
          <div className="p-4 border-b border-gray-700/60 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center justify-center flex-1">
              <img
                src="/yojana-setu-logo.png"
                alt="Yojana Setu"
                className="h-14 sm:h-16 w-auto object-contain bg-white/95 p-1.5 rounded-xl shadow-md border border-white/20"
              />
            </Link>

            <button
              className="md:hidden ml-2 text-gray-400 hover:text-white shrink-0"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Role Persona Card */}
          <div className="mx-3 mt-4 p-3 bg-stone-800/80 border border-stone-700/60 rounded-lg flex items-center gap-3 shadow-inner">
            <div className="w-8 h-8 rounded-full bg-[#de5c36] text-white flex items-center justify-center font-bold text-xs">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-amber-400">
                Logged in as
              </div>
              <div className="text-xs font-bold text-gray-100 truncate">
                {user.full_name || user.email}
              </div>
              <div className="text-[10px] text-gray-400 truncate">
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Categorized Navigation Menu */}
          <nav aria-label="Main Navigation" className="mt-4 px-3 space-y-4">
            {NAV_SECTIONS.map((section) => {
              const visibleItems = section.items.filter(
                (item) => !item.roles || (user && item.roles.includes(user.role))
              );

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.category} className="space-y-1">
                  <div className="px-3 text-[10px] font-bold tracking-wider text-stone-400 uppercase">
                    {section.category}
                  </div>
                  {visibleItems.map((item) => {
                    const isActive = item.exact
                      ? pathname === item.href
                      : pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "text-white bg-[#de5c36] shadow-md shadow-[#de5c36]/30 font-semibold"
                            : "text-gray-300 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isActive ? "text-white" : "text-gray-400"
                          }`}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom Tribal Pattern */}
        <div
          aria-hidden="true"
          className="relative w-full h-20 pointer-events-none opacity-15 overflow-hidden"
        >
          <svg
            className="absolute -bottom-6 -left-6 w-40 h-40 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 200 200"
          >
            <circle cx="100" cy="100" r="90" strokeDasharray="4,4" strokeWidth="1.5" />
            <circle cx="100" cy="100" r="54" strokeWidth="1" />
          </svg>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Bar Banner ── */}
        <header className="relative bg-gradient-to-r from-[#e7d8c6] via-[#dfccb7] to-[#d6bc9f] px-4 md:px-8 py-3.5 border-b border-[#cfbfa9] shadow-sm flex items-center justify-between overflow-hidden">
          <div className="absolute inset-0 opacity-25 pointer-events-none mix-blend-multiply flex items-end">
            <svg
              className="w-full h-16 text-[#8a7258]"
              fill="currentColor"
              preserveAspectRatio="none"
              viewBox="0 0 1200 120"
            >
              <path d="M0 120 L0 80 Q150 40 320 70 T680 50 T1000 80 T1200 45 L1200 120 Z" />
            </svg>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <button
              className="md:hidden p-1.5 text-stone-700 hover:text-stone-900"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <img
                src="/ashoka-emblem.png"
                alt="State Emblem of India"
                className="h-8 w-auto object-contain"
              />
              <div className="flex flex-col">
                <span className="text-[9px] text-stone-600 font-bold uppercase tracking-wider leading-none">
                  Govt. of India
                </span>
                <span className="text-[11px] text-stone-900 font-extrabold uppercase tracking-tight leading-tight">
                  Ministry of Tribal Affairs
                </span>
              </div>
              <span className="text-stone-300">|</span>
              <img
                src="/yojana-setu-logo.png"
                alt="Yojana Setu"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white/70 backdrop-blur-sm border border-amber-900/20 rounded-full text-xs font-semibold text-amber-900">
              <Briefcase className="w-3.5 h-3.5 text-[#de5c36]" />
              <span>Role: {roleLabel}</span>
            </div>

            <div className="flex items-center gap-2.5 pl-2 border-l border-stone-400/50">
              <div className="w-8 h-8 rounded-full bg-[#1e293b] text-white flex items-center justify-center text-xs font-semibold shadow">
                {userInitials}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-xs font-bold text-stone-900">
                  {user.full_name || user.email}
                </p>
                <p className="text-[10px] text-stone-600">
                  {roleLabel}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-stone-500 hover:text-rose-600 transition ml-1"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ── Main Content ── */}
        <main className="flex-1 p-5 md:p-7 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
