import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/** Top-level loading fallback (e.g. the landing page resolving its session). */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <LoadingSpinner />
    </div>
  );
}
