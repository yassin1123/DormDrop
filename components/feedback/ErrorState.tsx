import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** When provided, renders a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
}

/** Friendly, reusable error panel with an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  message = "We hit a snag loading this. Please try again.",
  onRetry,
  retryLabel = "Try again",
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <h2 className="font-display text-lg font-semibold text-slate-900">
        {title}
      </h2>
      <p className="text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          leftIcon={<RotateCw className="h-4 w-4" />}
          className="mt-2"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
