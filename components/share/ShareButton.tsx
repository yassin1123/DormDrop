"use client";

import { useState } from "react";
import { Loader2, Share2 } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { shareCard, type ShareCardOptions } from "@/lib/share-card";

interface ShareButtonProps {
  label?: string;
  caption: string;
  card: ShareCardOptions;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/** Generates a branded card image and opens the native share sheet (or
 *  downloads the image + copies the caption as a fallback). */
export function ShareButton({
  label = "Share",
  caption,
  card,
  variant = "outline",
  size = "md",
  className,
}: ShareButtonProps) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onShare() {
    setBusy(true);
    try {
      const result = await shareCard(card, caption);
      if (result === "downloaded") {
        toast.success("Card saved & caption copied — share away! 🚀");
      } else if (result === "copied") {
        toast.success("Caption copied to your clipboard!");
      }
    } catch {
      toast.error("Couldn't open the share sheet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onShare}
      disabled={busy}
      leftIcon={
        busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )
      }
    >
      {label}
    </Button>
  );
}
