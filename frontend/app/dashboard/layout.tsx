"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Layers,
  FileSpreadsheet,
  FileCheck2,
  History,
  LogOut,
  ShieldAlert,
  UserCheck,
  Building2,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Schemes",
    href: "/dashboard/schemes",
    icon: Layers,
    exact: false,
  },
  {
    label: "Applications",
    href: "/dashboard/applications",
    icon: FileSpreadsheet,
    exact: false,
  },
  {
    label: "Scrutiny Queue",
    href: "/dashboard/scrutiny",
    icon: FileCheck2,
    exact: false,
  },
  {
    label: "Selection Committee",
    href: "/dashboard/selection",
    icon: UserCheck,
    exact: false,
    roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"],
  },
  {
    label: "Audit Log",
    href: "/dashboard/audit",
    icon: History,
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <span>Loading administrative portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "SCHEME_ADMIN":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "SCRUTINY_OFFICER":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "SELECTION_COMMITTEE":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/40";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row antialiased selection:bg-indigo-500/30">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-white">SC/ST Portal</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-slate-300 hover:text-white"
        >
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar navigation */}
      <aside
        className={`fixed md:sticky top-0 z-30 h-screen w-64 flex-col bg-slate-900/95 border-r border-slate-800 backdrop-blur-xl transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? "translate-x-0 flex" : "-translate-x-full md:flex hidden"
        }`}
      >
        {/* Brand header */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 tracking-tight leading-tight">
                Scholarship Portal
              </div>
              <div className="text-[11px] text-slate-400 font-medium leading-tight mt-0.5">
                Admin & Scrutiny Engine
              </div>
            </div>
          </div>
        </div>

        {/* Navigation links */}
        <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Navigation
          </div>
          {NAV_ITEMS.filter(
            (item) => !item.roles || (user && item.roles.includes(user.role))
          ).map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
              </Link>
            );
          })}
        </div>

        {/* User profile & logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/80 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  {user.full_name || user.email}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
              </div>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 uppercase tracking-wider font-semibold border shrink-0 ${getRoleBadgeVariant(
                  user.role
                )}`}
              >
                {user.role.replace("_", " ")}
              </Badge>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start h-7 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 px-2 font-medium"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
        <div className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
