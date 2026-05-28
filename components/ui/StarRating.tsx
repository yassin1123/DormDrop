"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  /** Provide to make the stars interactive (tappable). */
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

/**
 * Star rating — interactive when `onChange` is passed, otherwise read-only.
 * Tapping fills with a quick pop; hovering previews.
 */
export function StarRating({
  value,
  onChange,
  size = "md",
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === "function";
  const shown = hover || value;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role={interactive ? "radiogroup" : undefined}
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= shown;
        const star_el = (
          <Star
            className={cn(
              SIZES[size],
              "transition-all duration-150",
              filled
                ? "fill-accent-400 text-accent-400"
                : "fill-stone-200 text-stone-200",
              interactive && filled && "scale-110",
            )}
          />
        );

        if (!interactive) return <span key={star}>{star_el}</span>;

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="press rounded-full p-0.5"
          >
            {star_el}
          </button>
        );
      })}
    </div>
  );
}
