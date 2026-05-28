"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bike,
  ChevronDown,
  LogOut,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ROLE_LABELS } from "@/lib/constants";
import { cn, getInitials } from "@/lib/utils";

/**
 * Responsive top navbar for the dashboard. Logo + role switcher (for "both"
 * accounts) + a tap-to-open account menu. On mobile it pairs with the bottom
 * tab bar; on desktop it's the primary nav.
 */
export function DashboardNavbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, signOut } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  const showSwitcher = profile?.role === "both";
  const name = profile?.full_name || "DormDrop";
  const zone = profile?.delivery_zone;

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <Link
          href="/requester"
          className="flex items-center gap-2 font-display font-bold text-stone-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white">
            <Package className="h-5 w-5" />
          </span>
          <span className="hidden text-lg sm:inline">DormDrop</span>
        </Link>

        {showSwitcher && (
          <div className="flex items-center rounded-full border border-stone-200 bg-stone-100 p-1">
            <SwitcherLink
              href="/requester"
              active={pathname.startsWith("/requester")}
              icon={<ShoppingBag className="h-4 w-4" />}
              label="Order"
            />
            <SwitcherLink
              href="/runner"
              active={pathname.startsWith("/runner")}
              icon={<Bike className="h-4 w-4" />}
              label="Deliver"
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <NotificationBell />
          <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="press flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-stone-100"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-800">
              {loading ? "" : getInitials(name)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-stone-900">
                {loading ? "…" : name}
              </span>
              {zone && (
                <span className="block text-xs leading-tight text-stone-500">
                  {zone}
                </span>
              )}
            </span>
            <ChevronDown className="h-4 w-4 text-stone-400" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-60 origin-top-right animate-scale-in rounded-xl border border-stone-200 bg-white p-1.5 shadow-soft-lg"
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 hover:bg-stone-50"
              >
                <p className="text-sm font-semibold text-stone-900">{name}</p>
                {zone && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                    <MapPin className="h-3 w-3" /> {zone}
                  </p>
                )}
                {profile && (
                  <span className="mt-2 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {ROLE_LABELS[profile.role]}
                  </span>
                )}
              </Link>

              <div className="my-1 border-t border-stone-100" />

              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
          </div>
        </div>
      </nav>
    </header>
  );
}

function SwitcherLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-white text-brand-800 shadow-sm"
          : "text-stone-500 hover:text-stone-700",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
