"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bike, ClipboardList, Home, ShoppingBag, Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/requester", label: "Order items", icon: ShoppingBag },
  { href: "/runner", label: "Deliver & earn", icon: Bike },
  { href: "/requester#orders", label: "My orders", icon: ClipboardList },
  { href: "/runner#reviews", label: "Reviews", icon: Star },
  { href: "/", label: "Home", icon: Home },
];

/** Dashboard sidebar navigation, highlighting the active route. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
      <nav className="sticky top-16 flex flex-col gap-1 p-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href.split("#")[0];
          return (
            <Link
              key={label}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
