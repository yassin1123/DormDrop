"use client";

import { useEffect, useState } from "react";

import { RateRunnerForm } from "@/components/reviews/RateRunnerForm";
import { Modal } from "@/components/ui/Modal";

interface PendingOrder {
  id: string;
  runner_id: string | null;
  runner: { id: string; full_name: string } | null;
}

const DISMISS_KEY = "dormdrop:review-dismissed";

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * Shown on a requester's next visit if they have a delivered order they
 * haven't rated. Dismissals are remembered (per order) so it doesn't nag.
 */
export function ReviewPromptModal() {
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews/pending")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const order = d.order as PendingOrder | null;
        if (!order || !order.runner_id) return;
        if (readDismissed().includes(order.id)) return;
        setPending(order);
        setOpen(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    if (pending) {
      try {
        localStorage.setItem(
          DISMISS_KEY,
          JSON.stringify([...readDismissed(), pending.id]),
        );
      } catch {
        // ignore
      }
    }
    setOpen(false);
  }

  if (!pending || !pending.runner_id) return null;

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="How was your last order? ⭐"
      description="Rate your runner — it only takes a second."
    >
      <RateRunnerForm
        orderId={pending.id}
        revieweeId={pending.runner_id}
        runnerName={pending.runner?.full_name}
        onDone={dismiss}
      />
    </Modal>
  );
}
