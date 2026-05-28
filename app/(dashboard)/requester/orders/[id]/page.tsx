import { notFound, redirect } from "next/navigation";

import { OrderDetail } from "@/components/orders/OrderDetail";
import { ORDER_SELECT } from "@/lib/order-select";
import { createServerClient } from "@/lib/supabase-server";
import type { OrderWithDetails } from "@/types";

export const metadata = { title: "Order" };

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS limits visibility to the requester / assigned runner, so a row the
  // viewer isn't allowed to see simply comes back null.
  const { data: order } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", params.id)
    .single();

  if (!order) notFound();

  return <OrderDetail initialOrder={order as unknown as OrderWithDetails} />;
}
