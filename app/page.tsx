import Link from "next/link";
import { ArrowRight, Bike, Clock, ShoppingBag, Sparkles, Star } from "lucide-react";

import { GoogleMap } from "@/components/map/GoogleMap";
import { Navbar } from "@/components/layout/Navbar";
import { Reveal } from "@/components/landing/Reveal";
import { IntroOnboarding } from "@/components/onboarding/IntroOnboarding";
import { Button } from "@/components/ui/Button";
import {
  DELIVERY_ZONES,
  SOUTHAMPTON_CENTER,
  ZONE_CLUSTERS,
  ZONE_COORDS,
} from "@/lib/constants";
import { getLiveStats } from "@/lib/stats";
import { createServerClient } from "@/lib/supabase-server";
import type { Profile } from "@/types";

// Reads the auth session per request — never statically prerendered.
export const dynamic = "force-dynamic";

const FLOATING_ITEMS = [
  { emoji: "🍫", className: "left-[6%] top-[12%]", anim: "animate-float", delay: "0s" },
  { emoji: "🥤", className: "right-[10%] top-[6%]", anim: "animate-float-tilt", delay: "0.4s" },
  { emoji: "🧻", className: "left-[2%] bottom-[20%]", anim: "animate-float-slow", delay: "0.9s" },
  { emoji: "🍜", className: "right-[4%] bottom-[14%]", anim: "animate-float", delay: "1.2s" },
  { emoji: "✏️", className: "left-[16%] bottom-[2%]", anim: "animate-float-tilt", delay: "0.6s" },
  { emoji: "💊", className: "right-[20%] bottom-[2%]", anim: "animate-float-slow", delay: "1.5s" },
];

// Pins for every delivery zone, dropped on the landing map.
const ZONE_MARKERS = Object.entries(ZONE_COORDS).map(([name, c]) => ({
  lat: c.lat,
  lng: c.lng,
  label: name,
}));

// Zones grouped roughly by geography so the section reads like a map.
const ZONE_GROUPS = [
  { label: "North & campus", zones: ZONE_CLUSTERS[0] },
  { label: "Central & east", zones: ZONE_CLUSTERS[1] },
  { label: "City & waterside", zones: ZONE_CLUSTERS[2] },
];

export default async function LandingPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Live platform stats (cached 60s).
  const stats = await getLiveStats();
  const socialProof = [
    {
      value: stats.delivered > 0 ? stats.delivered.toLocaleString("en-GB") : "New",
      label: stats.delivered > 0 ? "deliveries done" : "be our first!",
    },
    {
      value: `${stats.runnersOnline}`,
      label: stats.runnersOnline === 1 ? "runner online now" : "runners online now",
    },
    { value: `${DELIVERY_ZONES.length}`, label: "halls & areas" },
  ];

  let profile: Pick<Profile, "full_name" | "avatar_url" | "role"> | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url, role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const orderHref = profile ? "/requester" : "/signup";
  const runnerHref = profile ? "/runner" : "/signup";

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      {/* First-visit 3-screen intro (self-hides once seen). */}
      <IntroOnboarding />

      <Navbar profile={profile} />

      <main className="flex-1">
        {/* ============================ HERO ============================ */}
        <section className="hero-mesh relative overflow-hidden">
          <div className="container-page grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <Reveal>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-sm font-medium text-brand-800 shadow-sm backdrop-blur">
                  <Sparkles className="h-4 w-4 text-accent-500" />
                  For Southampton students only
                </span>
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
                  Anything delivered to your door.{" "}
                  <span className="text-brand-700">Any hour.</span>
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mx-auto mt-5 max-w-md text-lg text-stone-600 lg:mx-0">
                  By Southampton students, for Southampton students.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                  <Link href={orderHref} className="sm:w-auto">
                    <Button
                      size="lg"
                      className="group w-full sm:w-auto"
                      rightIcon={
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      }
                    >
                      Order Now
                    </Button>
                  </Link>
                  <Link href={runnerHref} className="sm:w-auto">
                    <Button
                      size="lg"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      leftIcon={<Bike className="h-4 w-4" />}
                    >
                      Earn as a Runner
                    </Button>
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <p className="mt-5 flex items-center justify-center gap-2 text-sm text-stone-500 lg:justify-start">
                  <Clock className="h-4 w-4 text-brand-600" />
                  Open 24/7 · no minimum order · flat £2.00 delivery
                </p>
              </Reveal>

              {/* Social proof */}
              <Reveal delay={400}>
                <div className="mt-8 flex justify-center gap-8 lg:justify-start">
                  {socialProof.map((s) => (
                    <div key={s.label}>
                      <p className="font-display text-2xl font-extrabold text-stone-900">
                        {s.value}
                      </p>
                      <p className="text-xs text-stone-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Animated visual */}
            <Reveal delay={200} className="relative">
              <div className="relative mx-auto aspect-square w-full max-w-sm">
                {FLOATING_ITEMS.map((item) => (
                  <span
                    key={item.emoji}
                    aria-hidden
                    style={{ animationDelay: item.delay }}
                    className={`absolute hidden h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-soft ring-1 ring-black/5 sm:flex ${item.className} ${item.anim}`}
                  >
                    {item.emoji}
                  </span>
                ))}

                <div className="absolute left-1/2 top-1/2 w-64 -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-stone-100 bg-white p-5 shadow-soft-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-stone-400">
                      Your order
                    </span>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-500" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-600" />
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {[
                      { e: "🍫", n: "Dairy Milk", p: "£1.75" },
                      { e: "🥤", n: "Red Bull", p: "£1.75" },
                      { e: "💊", n: "Paracetamol", p: "£1.25" },
                    ].map((row) => (
                      <div
                        key={row.n}
                        className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2"
                      >
                        <span className="text-lg">{row.e}</span>
                        <span className="flex-1 text-sm font-medium text-stone-700">
                          {row.n}
                        </span>
                        <span className="text-sm text-stone-500">{row.p}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-900 px-3 py-2.5 text-white">
                    <Bike className="h-4 w-4 text-accent-400" />
                    <span className="text-sm font-medium">On the way</span>
                    <span className="ml-auto text-sm font-semibold">12 min</span>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Zones marquee ribbon */}
          <div className="relative border-y border-stone-200/70 bg-white/70 py-3 backdrop-blur">
            <div className="flex w-max animate-marquee gap-3 whitespace-nowrap">
              {[...DELIVERY_ZONES, ...DELIVERY_ZONES].map((zone, i) => (
                <span
                  key={`${zone}-${i}`}
                  className="flex items-center gap-2 text-sm font-medium text-stone-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                  {zone}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ======================= HOW IT WORKS ======================= */}
        <section className="container-page py-16 sm:py-24">
          <Reveal className="mx-auto max-w-xl text-center">
            <h2 className="font-display text-3xl font-bold text-stone-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mt-3 text-stone-600">
              Three taps from craving to doorstep.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                emoji: "🛒",
                title: "Pick what you need",
                body: "Browse snacks, drinks, and essentials from shops near campus.",
              },
              {
                step: "2",
                emoji: "🏃",
                title: "A Runner grabs it",
                body: "Another student nearby picks it up and heads your way.",
              },
              {
                step: "3",
                emoji: "🚪",
                title: "Delivered to your door",
                body: "Fast, 24/7, and no minimum order.",
              },
            ].map((s, i) => (
              <Reveal key={s.step} delay={i * 120}>
                <div className="group relative h-full rounded-3xl border border-stone-100 bg-white p-7 shadow-soft transition-all hover:-translate-y-1 hover:shadow-soft-lg">
                  <span className="absolute -top-4 left-7 flex h-9 w-9 items-center justify-center rounded-full bg-brand-900 font-display text-sm font-bold text-white shadow-md">
                    {s.step}
                  </span>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-3xl transition-transform group-hover:scale-110">
                    {s.emoji}
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-stone-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-stone-600">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ======================= DELIVERY ZONES ======================= */}
        <section className="border-y border-stone-200 bg-white py-16 sm:py-24">
          <div className="container-page">
            <Reveal className="mx-auto max-w-xl text-center">
              <h2 className="font-display text-3xl font-bold text-stone-900 sm:text-4xl">
                Delivering across campus &amp; beyond
              </h2>
              <p className="mt-3 text-stone-600">
                If you live here, we drop here.
              </p>
            </Reveal>

            {/* Geographic-ish grouping */}
            <div className="mt-10 grid gap-5 sm:grid-cols-3">
              {ZONE_GROUPS.map((group, gi) => (
                <Reveal key={group.label} delay={gi * 120}>
                  <div className="rounded-3xl border border-stone-100 bg-stone-50 p-5">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
                      <span className="h-2 w-2 rounded-full bg-brand-500" />
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.zones.map((zone) => (
                        <span
                          key={zone}
                          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-800"
                        >
                          {zone}
                        </span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            {/* Supporting map — a subtle pinned overview of the zones. */}
            <Reveal delay={120}>
              <div className="mt-8 overflow-hidden rounded-3xl border border-stone-200 shadow-soft">
                <GoogleMap
                  center={SOUTHAMPTON_CENTER}
                  zoom={12}
                  markers={ZONE_MARKERS}
                  className="h-72 w-full sm:h-96"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* ====================== BECOME A RUNNER ====================== */}
        <section className="container-page py-16 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-brand-900 px-6 py-14 text-center shadow-soft-lg sm:px-12 sm:py-20">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent-500/20 blur-2xl"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-brand-500/30 blur-2xl"
              />

              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-accent-300">
                <Bike className="h-4 w-4" /> Become a Runner
              </span>
              <h2 className="relative mt-5 font-display text-3xl font-bold text-white sm:text-4xl">
                Make money between lectures.
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-lg text-brand-100">
                Set your own hours. No car needed.
              </p>
              <div className="relative mt-8 flex justify-center">
                <Link href={runnerHref} className="w-full sm:w-auto">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="group w-full sm:w-auto"
                    rightIcon={
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    }
                  >
                    Sign up as a Runner
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ============================ FOOTER ============================ */}
      <footer className="border-t border-stone-200 bg-white">
        <div className="container-page flex flex-col items-center justify-between gap-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display font-bold text-stone-900">DormDrop</p>
              <p className="flex items-center gap-1 text-sm text-stone-500">
                Built for UoS students
                <Star className="h-3 w-3 fill-accent-400 text-accent-400" />
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-6 text-sm font-medium text-stone-600">
            <Link href="/help" className="hover:text-brand-700">
              Help
            </Link>
            <Link href="/login" className="hover:text-brand-700">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-brand-700">
              Sign up
            </Link>
          </nav>

          <p className="text-sm text-stone-400">
            © {new Date().getFullYear()} DormDrop
          </p>
        </div>
      </footer>
    </div>
  );
}
