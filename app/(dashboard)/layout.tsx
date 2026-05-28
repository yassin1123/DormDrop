import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/BottomNav";
import { DashboardNavbar } from "@/components/layout/DashboardNavbar";
import { createServerClient } from "@/lib/supabase-server";

/**
 * Auth + onboarding gate and chrome for the dashboard. Middleware already
 * enforces these; we re-check here as defence-in-depth. Top navbar on every
 * size, plus a native-style bottom tab bar on mobile.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <DashboardNavbar />
      {/* Bottom padding clears the mobile tab bar (and its safe area). */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-28 md:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
