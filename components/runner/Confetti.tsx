"use client";

import { useMemo } from "react";

const COLORS = [
  "#064e3b",
  "#10b981",
  "#34d399",
  "#f59e0b",
  "#fbbf24",
  "#ffffff",
];

/**
 * A one-shot burst of falling confetti. Pure CSS (the `confetti-fall` keyframe
 * lives in globals.css) — no dependencies. Renders once on mount.
 */
export function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        left: Math.random() * 100,
        bg: COLORS[i % COLORS.length],
        delay: Math.random() * 0.6,
        duration: 2 + Math.random() * 1.8,
        size: 6 + Math.random() * 7,
        round: Math.random() > 0.5,
      })),
    [count],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.bg,
            borderRadius: p.round ? "9999px" : "2px",
            animation: `confetti-fall ${p.duration}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
