"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, Package, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { createBrowserClient } from "@/lib/supabase";
import { getInitials } from "@/lib/utils";
import type { Profile } from "@/types";

interface NavbarProps {
  /** The signed-in profile, if any. Server components pass this in. */
  profile?: Pick<Profile, "full_name" | "avatar_url" | "role"> | null;
}

/** Top navigation bar. Shows auth actions or the signed-in user + sign out. */
export function Navbar({ profile }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-display font-bold text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white">
            <Package className="h-5 w-5" />
          </span>
          <span className="text-lg">DormDrop</span>
        </Link>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          {profile ? (
            <>
              <Link
                href="/requester"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Order
              </Link>
              <Link
                href="/runner"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Deliver
              </Link>
              <div className="flex items-center gap-2 pl-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {getInitials(profile.full_name || "DD")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  isLoading={signingOut}
                  onClick={handleSignOut}
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {profile ? (
              <>
                <Link href="/requester" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Order
                </Link>
                <Link href="/runner" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Deliver
                </Link>
                <button
                  onClick={handleSignOut}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Log in
                </Link>
                <Link href="/signup" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
