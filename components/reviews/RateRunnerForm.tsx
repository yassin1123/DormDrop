"use client";

import { useState } from "react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { Textarea } from "@/components/ui/Textarea";

interface RateRunnerFormProps {
  orderId: string;
  revieweeId: string;
  runnerName?: string | null;
  /** Called after a successful submit. */
  onDone: () => void;
}

/**
 * Star rating + optional comment, posting to /api/reviews. The DB trigger
 * recomputes the runner's average rating and notifies them.
 */
export function RateRunnerForm({
  orderId,
  revieweeId,
  runnerName,
  onDone,
}: RateRunnerFormProps) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) {
      setError("Tap a star to rate.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          reviewee_id: revieweeId,
          rating,
          comment: comment.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit review.");
      toast.success("Thanks for the feedback! ⭐");
      onDone();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-2">
        <p className="text-sm text-stone-500">
          How was {runnerName?.split(" ")[0] || "your runner"}?
        </p>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      <Textarea
        label="Add a comment (optional)"
        placeholder="Fast, friendly, found everything…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <Button className="w-full" isLoading={submitting} onClick={submit}>
        Submit review
      </Button>
    </div>
  );
}
