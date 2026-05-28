import { RunnerHistory } from "@/components/runner/RunnerHistory";

export const metadata = { title: "History" };

// Dynamic so the (dashboard) layout (which reads the session) is never
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export default function RunnerHistoryPage() {
  return <RunnerHistory />;
}
