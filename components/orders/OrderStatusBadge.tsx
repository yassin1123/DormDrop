import { Badge } from "@/components/ui/Badge";
import { ORDER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

/** Renders an order's status as a coloured pill, driven by ORDER_STATUSES. */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const config = ORDER_STATUSES[status];

  return (
    <Badge classOverride={config.badgeClass} className={className}>
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      {config.label}
    </Badge>
  );
}
