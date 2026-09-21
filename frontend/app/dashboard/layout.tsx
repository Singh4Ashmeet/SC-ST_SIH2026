"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard,
  Layers3,
  FileSpreadsheet,
  FileCheck2,
  History,
  LogOut,
  UserCheck,
  Menu,
  ShieldCheck,
  ChevronRight,
  Banknote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Schemes & Rules", href: "/dashboard/schemes", icon: Layers3, exact: false },
  { label: "Applications", href: "/dashboard/applications", icon: FileSpreadsheet, exact: false },
  { label: "AI Scrutiny Queue", href: "/dashboard/scrutiny", icon: FileCheck2, exact: false },
  { label: "Selection Committee", href: "/dashboard/selection", icon: UserCheck, exact: false, roles: ["SUPER_ADMIN", "SELECTION_COMMITTEE"] },
  { label: "Post-Selection", href: "/dashboard", icon: Banknote, exact: false },
  { label: "Audit Trail", href: "/dashboard/audit", icon: History, exact: false },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/login");
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "#0A0F1E", color: "#F1E4C9" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E09E18] border-t-transparent" />
          <span className="text-xs">Loading administrative portal...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen antialiased" style={{ background: "#FAF8F4", color: "#0A0F1E" }}>
      <div className="md:hidden sticky top-0 z-50 flex items-center justify-between border-b px-4 py-3 backdrop-blur" style={{ background: "#FAF8F4F2", borderColor: "#E7E0D3" }}>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: "#1B4332" }}>
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span className="text-xs font-bold">MoTA Scholarship System</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen(!mobileOpen)} className="text-slate-700">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-[248px] flex-col border-r transition-transform duration-200 md:sticky md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:flex"}`}
        style={{ background: "#1B4332", borderColor: "#123524", color: "#FAF8F4" }}
      >
        <div className="border-b px-5 py-5" style={{ borderColor: "#2C5A47" }}>
          <Link href="/dashboard" className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "#0A0F1E", color: "#E09E18" }}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "#F1E4C9" }}>Ministry of Tribal Affairs</p>
              <p className="mt-1 text-sm font-bold leading-tight text-white">Scholarship & Fellowship</p>
              <p className="mt-0.5 text-[9px]" style={{ color: "#B8C8BC" }}>Management & Scrutiny System</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: "#AFC0B4" }}>Operations</p>
          <div className="space-y-1">
            {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors"
                  style={active ? { background: "#E09E18", color: "#0A0F1E" } : { color: "#E5EDE8" }}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  {active && <ChevronRight className="h-3.5 w-3.5" />}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="border-t p-3" style={{ borderColor: "#2C5A47" }}>
          <div className="rounded-lg p-3" style={{ background: "#153A2C" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">{user.full_name || user.email}</p>
                <p className="mt-0.5 truncate text-[9px]" style={{ color: "#AFC0B4" }}>{user.email}</p>
              </div>
              <Badge variant="outline" className="shrink-0 border-0 text-[8px] font-bold" style={{ background: "#E09E18", color: "#0A0F1E" }}>
                {user.role.replaceAll("_", " ")}
              </Badge>
            </div>
            <Button onClick={logout} variant="ghost" size="sm" className="mt-2 h-7 w-full justify-start px-1 text-[10px] text-[#F1C7B7] hover:bg-[#A64B2C]/20 hover:text-white">
              <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </aside>

      <main className="min-h-screen md:ml-0">
        <div className="mx-auto w-full max-w-[1500px] p-4 sm:p-5 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
