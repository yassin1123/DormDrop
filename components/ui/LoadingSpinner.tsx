import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  /** Tailwind size classes for the icon, e.g. "h-5 w-5". */
  className?: string;
  /** Optional label shown beneath the spinner. */
  label?: string;
  /** Center within a full-height area. */
  fullScreen?: boolean;
}

/** A simple, brand-coloured loading spinner. */
export function LoadingSpinner({
  className,
  label,
  fullScreen = false,
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-brand-600",
        fullScreen && "min-h-[50vh]",
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn("h-6 w-6 animate-spin", className)} />
      {label && <p className="text-sm text-slate-500">{label}</p>}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
