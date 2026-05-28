"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";

/** Route error boundary for the admin section, with a retry. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <ErrorState
      message="Couldn't load this admin view. Please try again."
      onRetry={reset}
    />
  );
}
