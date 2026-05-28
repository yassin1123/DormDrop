"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Package } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const SEEN_KEY = "dormdrop:intro-seen";

const SLIDES = [
  {
    title: "Welcome to DormDrop",
    body: "Snacks, drinks and essentials — delivered to your door by fellow Southampton students.",
    art: (
      <ArtBlob emoji="💧">
        <Float className="-left-6 top-2 animate-float">🍫</Float>
        <Float className="-right-6 top-6 animate-float-tilt">🥤</Float>
        <Float className="bottom-0 left-2 animate-float-slow">🧻</Float>
      </ArtBlob>
    ),
  },
  {
    title: "Order anything, anytime",
    body: "Pick what you need, a student runner grabs it, and it lands at your door — usually in 15–30 minutes.",
    art: (
      <ArtBlob emoji="🛒">
        <Float className="-right-7 top-2 animate-float">🏃</Float>
        <Float className="-left-6 bottom-2 animate-float-slow">🚪</Float>
        <Float className="-right-4 bottom-6 animate-float-tilt">⚡</Float>
      </ArtBlob>
    ),
  },
  {
    title: "Earn money as a Runner",
    body: "Free between lectures? Deliver orders near you and earn on your own schedule. No car needed.",
    art: (
      <ArtBlob emoji="🚴">
        <Float className="-right-6 top-3 animate-float">💷</Float>
        <Float className="-left-6 top-6 animate-float-tilt">📦</Float>
        <Float className="bottom-1 right-2 animate-float-slow">✨</Float>
      </ArtBlob>
    ),
  },
];

export function IntroOnboarding() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) !== "1") setVisible(true);
    } catch {
      // ignore — don't block the app if storage is unavailable
    }
  }, []);

  function finish(goSignup: boolean) {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
    if (goSignup) router.push("/signup");
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return;
    const delta = e.changedTouches[0].clientX - startX.current;
    startX.current = null;
    if (delta < -50 && index < SLIDES.length - 1) setIndex((i) => i + 1);
    else if (delta > 50 && index > 0) setIndex((i) => i - 1);
  }

  if (!visible) return null;
  const last = index === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-stone-50">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6">
        <span className="flex items-center gap-2 font-display font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-900 text-white">
            <Package className="h-5 w-5" />
          </span>
          DormDrop
        </span>
        <button
          type="button"
          onClick={() => finish(false)}
          className="text-sm font-medium text-stone-500 hover:text-stone-700"
        >
          Skip
        </button>
      </div>

      {/* Slides */}
      <div
        className="flex-1 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {SLIDES.map((s) => (
            <div
              key={s.title}
              className="flex h-full w-full shrink-0 flex-col items-center justify-center px-8 text-center"
            >
              <div className="mb-10">{s.art}</div>
              <h2 className="font-display text-3xl font-extrabold text-stone-900">
                {s.title}
              </h2>
              <p className="mt-3 max-w-sm text-lg text-stone-600">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 pb-10">
        <div className="mb-6 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-brand-700" : "w-2 bg-stone-300",
              )}
            />
          ))}
        </div>
        <Button
          size="lg"
          className="w-full"
          onClick={() => (last ? finish(true) : setIndex((i) => i + 1))}
          rightIcon={<ArrowRight className="h-4 w-4" />}
        >
          {last ? "Get started" : "Next"}
        </Button>
      </div>
    </div>
  );
}

function ArtBlob({
  emoji,
  children,
}: {
  emoji: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-44 w-44 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-brand-100 to-accent-100 ring-1 ring-black/5">
      <span className="text-7xl">{emoji}</span>
      {children}
    </div>
  );
}

function Float({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "absolute flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-soft ring-1 ring-black/5",
        className,
      )}
    >
      {children}
    </span>
  );
}
