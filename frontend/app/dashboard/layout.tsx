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
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutGrid,
    exact: true,
  },
  {
    label: "Application Verification",
    href: "/dashboard/applications",
    icon: FileCheck2,
    exact: false,
  },
  {
    label: "Scheme Rule Studio",
    href: "/dashboard/schemes",
    icon: Sparkles,
    exact: false,
  },
  {
    label: "AI Scrutiny",
    href: "/dashboard/scrutiny",
    icon: Cpu,
    exact: false,
  },
  {
    label: "Merit & Selection",
    href: "/dashboard/selection",
    icon: Award,
    exact: false,
    roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"],
  },
  {
    label: "Conflict Detection",
    href: "/dashboard/conflicts",
    icon: Shield,
    exact: false,
    roles: ["SUPER_ADMIN", "SCHEME_ADMIN"],
  },
  {
    label: "Grievances",
    href: "/dashboard/grievances",
    icon: MessageSquareWarning,
    exact: false,
  },
  {
    label: "Policy Simulator",
    href: "/dashboard/simulation",
    icon: Sliders,
    exact: false,
    roles: ["SUPER_ADMIN", "SCHEME_ADMIN"],
  },
  {
    label: "Audit Trail",
    href: "/dashboard/audit",
    icon: FileText,
    exact: false,
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
        <div className="relative z-10">
          {/* Portal Brand & Emblem */}
          <div className="p-5 border-b border-gray-700/60 flex items-start gap-3">
            {/* National Emblem Icon */}
            <div className="w-10 h-11 flex-shrink-0 flex items-center justify-center bg-gray-700/40 rounded border border-gray-600/50 text-amber-300">
              <svg
                aria-label="National Emblem of India"
                className="w-7 h-7 fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L9 7h6l-3-5zm0 6c-2.5 0-4 1.5-4 4v3h8v-3c0-2.5-1.5-4-4-4zm-6 8h12v2H6v-2zm2 3h8v1H8v-1z" />
                <circle cx="12" cy="14" r="1.5" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] tracking-wider uppercase font-semibold text-gray-400 leading-tight">
                Govt. of India
              </span>
              <h1 className="text-xs font-bold text-gray-100 uppercase leading-snug">
                Ministry of Tribal Affairs
              </h1>
              <p className="text-[9px] text-amber-200/80 font-medium tracking-tight mt-0.5 leading-tight">
                SCHOLARSHIP &amp; FELLOWSHIP
                <br />
                MANAGEMENT SYSTEM
              </p>
            </div>

            {/* Mobile close */}
            <button
              className="md:hidden ml-auto text-gray-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav aria-label="Main Navigation" className="mt-5 px-3 space-y-1.5">
            {NAV_ITEMS.filter(
              (item) => !item.roles || (user && item.roles.includes(user.role))
            ).map((item) => {
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
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
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
          </nav>
        </div>

        {/* Bottom Tribal Art Geometric Decoration */}
        <div
          aria-hidden="true"
          className="relative w-full h-44 pointer-events-none opacity-20 overflow-hidden"
        >
          <svg
            className="absolute -bottom-6 -left-6 w-56 h-56 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 200 200"
          >
            {/* Warli concentric tribal radial ring */}
            <circle
              cx="100"
              cy="100"
              r="90"
              strokeDasharray="4,4"
              strokeWidth="1.5"
            />
            <circle cx="100" cy="100" r="72" strokeWidth="1" />
            <circle
              cx="100"
              cy="100"
              r="54"
              strokeDasharray="2,6"
              strokeWidth="2"
            />
            <circle cx="100" cy="100" r="36" strokeWidth="1" />
            {/* Geometric triangles representing folk dancers */}
            <path
              d="M100 10 L104 26 L96 26 Z M100 190 L104 174 L96 174 Z M10 100 L26 96 L26 104 Z M190 100 L174 96 L174 104 Z"
              fill="currentColor"
            />
            <path
              d="M36 36 L48 44 L40 52 Z M164 164 L152 156 L160 148 Z M164 36 L156 48 L148 40 Z M36 164 L44 152 L52 160 Z"
              fill="currentColor"
            />
            <circle
              cx="100"
              cy="100"
              fill="currentColor"
              fillOpacity="0.2"
              r="14"
            />
          </svg>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Bar Banner ── */}
        <header className="relative bg-gradient-to-r from-[#e7d8c6] via-[#dfccb7] to-[#d6bc9f] px-4 md:px-8 py-3.5 border-b border-[#cfbfa9] shadow-sm flex items-center justify-between overflow-hidden">
          {/* Background mountain ridge scenic silhouette */}
          <div className="absolute inset-0 opacity-25 pointer-events-none mix-blend-multiply flex items-end">
            <svg
              className="w-full h-16 text-[#8a7258]"
              fill="currentColor"
              preserveAspectRatio="none"
              viewBox="0 0 1200 120"
            >
              <path d="M0 120 L0 80 Q150 40 320 70 T680 50 T1000 80 T1200 45 L1200 120 Z" />
              <path
                d="M0 120 L0 95 Q220 65 480 85 T900 65 T1200 90 L1200 120 Z"
                opacity="0.6"
              />
            </svg>
          </div>

          {/* Left: Mobile menu + Tagline */}
          <div className="relative z-10 flex items-center gap-3">
            <button
              className="md:hidden p-1.5 text-stone-700 hover:text-stone-900"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-serif italic text-amber-950 font-medium text-sm sm:text-base tracking-wide drop-shadow-sm hidden sm:block">
              &ldquo;Empowering Tribal Communities Through Education&rdquo;
            </span>
          </div>

          {/* Right: Search, Notifications & Admin Profile */}
          <div className="relative z-10 flex items-center gap-3 md:gap-4">
            {/* Search Input */}
            <div className="relative w-48 md:w-72 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white/90 backdrop-blur-sm border border-stone-300 rounded-full text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-700 focus:bg-white transition"
                placeholder="Search applications, student ID, scheme..."
                type="text"
              />
            </div>

            {/* Notification Bell with badge */}
            <button
              aria-label="Notifications"
              className="relative p-2 text-stone-700 hover:text-stone-900 bg-white/60 hover:bg-white/90 rounded-full transition shadow-sm"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-0.5 right-0.5 bg-red-600 text-white font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                5
              </span>
            </button>

            {/* Admin Profile Pill */}
            <div className="flex items-center gap-2.5 pl-2 border-l border-stone-400/50">
              <div className="w-8 h-8 rounded-full bg-[#1e293b] text-white flex items-center justify-center text-xs font-semibold shadow">
                {userInitials}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <p className="text-xs font-bold text-stone-900">
                  {user.full_name || user.email}
                </p>
                <p className="text-[10px] text-stone-600">
                  {user.role.replace(/_/g, " ")}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-stone-500 hover:text-rose-600 transition"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
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
