"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

import { createBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/items", label: "Items", icon: Package },
  {
    href: "/admin/collection-points",
    label: "Collection Points",
    icon: MapPin,
  },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
];

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);
}

export function AdminSidebar() {
  const router = useRouter();
  const isActive = useActive();

  async function signOut() {
    await createBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex h-16 items-center gap-2 px-5 font-display font-bold text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
            <Package className="h-5 w-5" />
          </span>
          DormDrop
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
            Admin
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-slate-800 px-3 py-4">
          <Link
            href="/requester"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white"
          >
            <ExternalLink className="h-4 w-4" /> Back to app
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-slate-300 md:hidden">
        <div className="flex h-14 items-center justify-between px-4 font-display font-bold text-white">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600">
              <Package className="h-4 w-4" />
            </span>
            Admin
          </span>
          <button type="button" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-5 w-5 text-slate-400" />
          </button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-slate-800 px-3 pb-2">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium",
                  active ? "bg-slate-800 text-white" : "text-slate-400",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
