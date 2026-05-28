"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/ErrorState";

/** Root error boundary (covers the landing + auth pages). */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <ErrorState onRetry={reset} />
    </div>
  );
}
