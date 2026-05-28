import { redirect } from "next/navigation";

import { CheckoutFlow } from "@/components/orders/CheckoutFlow";
import { createServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/types";

export const metadata = { title: "Checkout" };

// Reads the session + Stripe redirect query params — never prerendered.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return <CheckoutFlow profile={profile as Profile} />;
}
