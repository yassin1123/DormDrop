import { redirect } from "next/navigation";

import { ActiveDelivery } from "@/components/runner/ActiveDelivery";
import { ORDER_SELECT } from "@/lib/order-select";
import { createServerClient } from "@/lib/supabase-server";
import type { OrderWithDetails } from "@/types";

export const metadata = { title: "Delivery" };

export const dynamic = "force-dynamic";

export default async function DeliveryPage({
  params,
}: {
  params: { orderId: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", params.orderId)
    .single();

  // Must be this runner's delivery. (RLS also lets runners read the open pool,
  // so explicitly require ownership here.)
  if (!order || order.runner_id !== user.id) {
    redirect("/runner");
  }

  return <ActiveDelivery initialOrder={order as unknown as OrderWithDetails} />;
}
