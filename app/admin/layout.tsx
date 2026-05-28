import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdmin } from "@/lib/admin";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defence-in-depth: middleware already gates /admin, but re-check here.
  const user = await requireAdmin(createServerClient());
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-100">
      <AdminSidebar />
      <main className="md:pl-60">
        <div className="mx-auto max-w-7xl p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
}
