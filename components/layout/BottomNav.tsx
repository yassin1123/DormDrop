"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  ClipboardList,
  Home,
  Package,
  ShoppingBag,
  User,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
}

const REQUESTER_TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home, isActive: (p) => p === "/" },
  {
    href: "/requester",
    label: "Browse",
    icon: ShoppingBag,
    isActive: (p) => p === "/requester" || p.startsWith("/requester/checkout"),
  },
  {
    href: "/requester/orders",
    label: "Orders",
    icon: ClipboardList,
    isActive: (p) => p.startsWith("/requester/orders"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
    isActive: (p) => p.startsWith("/profile"),
  },
];

const RUNNER_TABS: Tab[] = [
  { href: "/", label: "Home", icon: Home, isActive: (p) => p === "/" },
  {
    href: "/runner",
    label: "Available",
    icon: Package,
    isActive: (p) => p === "/runner",
  },
  {
    href: "/runner/history",
    label: "Deliveries",
    icon: Bike,
    isActive: (p) =>
      p.startsWith("/runner/history") || p.startsWith("/runner/delivery"),
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User,
    isActive: (p) => p.startsWith("/profile"),
  },
];

/**
 * Native-app-style bottom tab bar (mobile only). The tab set follows the
 * section you're in (so "both" accounts get the right tabs), falling back to
 * the account's role on neutral pages like /profile. A sliding bar marks the
 * active tab. Fixed to the bottom with iOS safe-area padding.
 */
// Focused, full-screen flows hide the tab bar (like a native checkout sheet).
const HIDDEN_PREFIXES = ["/requester/checkout", "/runner/delivery"];

export function BottomNav() {
  const pathname = usePathname();
  const { profile } = useAuth();

  // Hide on scroll-down, reveal on scroll-up (like mobile Chrome's URL bar) to
  // give content more room. Kept above the early return to satisfy hook rules.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (Math.abs(y - lastY.current) < 6) return; // ignore jitter
      setHidden(y > lastY.current && y > 80); // hide going down, not near top
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const inRunnerSection = pathname.startsWith("/runner");
  const inRequesterSection = pathname.startsWith("/requester");
  const tabs =
    inRunnerSection || (!inRequesterSection && profile?.role === "runner")
      ? RUNNER_TABS
      : REQUESTER_TABS;

  const activeIndex = tabs.findIndex((t) => t.isActive(pathname));

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur transition-transform duration-300 md:hidden",
        hidden ? "translate-y-full" : "translate-y-0",
      )}
    >
      <div className="relative">
        {/* Sliding active indicator */}
        <span
          aria-hidden
          className={cn(
            "absolute top-0 h-0.5 w-1/4 rounded-full bg-brand-700 transition-transform duration-300 ease-out",
            activeIndex < 0 && "opacity-0",
          )}
          style={{ transform: `translateX(${Math.max(activeIndex, 0) * 100}%)` }}
        />
        <div className="flex">
          {tabs.map((tab) => {
            const active = tab.isActive(pathname);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="press flex flex-1 flex-col items-center gap-0.5 py-2.5"
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    active
                      ? "fill-brand-100 text-brand-700"
                      : "text-stone-400",
                  )}
                />
                <span
                  className={cn(
                    "text-[11px] font-medium transition-colors",
                    active ? "text-brand-700" : "text-stone-400",
                  )}
                >
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Safe-area spacer for the home indicator. */}
      <div className="pb-safe" />
    </nav>
  );
}
