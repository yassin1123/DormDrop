import { RequesterOrderHistory } from "@/components/orders/RequesterOrderHistory";

export const metadata = { title: "My orders" };

// Dynamic so the (dashboard) layout (which reads the session) is never
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export default function RequesterOrdersPage() {
  return <RequesterOrderHistory />;
}
