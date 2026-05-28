"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";

/** Route error boundary for all dashboard pages, with a retry. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <ErrorState
      message="We couldn't load this page. Please try again."
      onRetry={reset}
    />
  );
}
