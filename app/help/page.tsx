import Link from "next/link";
import { ChevronDown, LifeBuoy, Package } from "lucide-react";

import { ReportProblemForm } from "@/components/help/ReportProblemForm";
import { DELIVERY_ZONES } from "@/lib/constants";

export const metadata = {
  title: "Help & FAQ",
  description: "Answers to common DormDrop questions, and a way to report a problem.",
};

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "How long does delivery take?",
    a: "Usually 15–30 minutes, depending on how far the shop and your hall are, and how busy runners are.",
  },
  {
    q: "What items are available?",
    a: (
      <>
        Snacks, drinks, essentials, stationery and personal care.{" "}
        <Link href="/requester" className="font-medium text-brand-700 underline">
          Browse the full catalogue
        </Link>
        .
      </>
    ),
  },
  {
    q: "How do I become a runner?",
    a: "Sign up and choose “Runner” (or “Both”) as your role during onboarding. Then flip yourself online to start receiving orders.",
  },
  {
    q: "How do I get paid as a runner?",
    a: "Earnings are tracked per delivery and shown on your dashboard (you keep 100% of the delivery fee). Automatic payouts are coming soon.",
  },
  {
    q: "Is it available 24/7?",
    a: "Yes — whenever a runner is online in your area. If none are online, your order waits in the queue and is matched as soon as one goes online.",
  },
  {
    q: "What areas do you deliver to?",
    a: (
      <div className="flex flex-wrap gap-1.5">
        {DELIVERY_ZONES.map((z) => (
          <span
            key={z}
            className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600"
          >
            {z}
          </span>
        ))}
      </div>
    ),
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-display font-bold text-stone-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white">
              <Package className="h-5 w-5" />
            </span>
            DormDrop
          </Link>
          <Link
            href="/requester"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Open app →
          </Link>
        </div>
      </header>

      <main className="container-page max-w-2xl py-10">
        <div className="flex items-center gap-2 text-brand-700">
          <LifeBuoy className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Help &amp; support
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold text-stone-900">
          How can we help?
        </h1>

        {/* FAQ */}
        <div className="mt-8 space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-stone-200 bg-white shadow-soft"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-medium text-stone-900">
                {item.q}
                <ChevronDown className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="px-4 pb-4 text-sm text-stone-600">{item.a}</div>
            </details>
          ))}
        </div>

        {/* Report a problem */}
        <div className="mt-12">
          <h2 className="font-display text-xl font-bold text-stone-900">
            Report a problem
          </h2>
          <p className="mb-4 mt-1 text-sm text-stone-500">
            Something not right? Tell us and we&apos;ll sort it.
          </p>
          <ReportProblemForm />
        </div>
      </main>
    </div>
  );
}
