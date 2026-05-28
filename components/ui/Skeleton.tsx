import { cn } from "@/lib/utils";

/** A shimmering placeholder block for loading states. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/70", className)}
      {...props}
    />
  );
}

/** A card-shaped skeleton, handy for list/grid placeholders. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-slate-200 bg-white p-4",
        className,
      )}
    >
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
