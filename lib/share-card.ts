/**
 * Canvas-generated, branded "shareable card" images — no design assets needed.
 * Used by the Share buttons (runner earnings, requester delivery). Everything
 * here runs only in the browser, on a user click.
 */
export interface ShareCardOptions {
  eyebrow: string;
  headline: string;
  /** Big highlighted stat (e.g. "£12.50"). Optional. */
  stat?: string;
  /** Smaller supporting line. Optional. */
  subline?: string;
  emoji?: string;
}

const SIZE = 1080;

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateShareCard(
  opts: ShareCardOptions,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient + soft accent glow.
  const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  grad.addColorStop(0, "#064e3b");
  grad.addColorStop(0.6, "#065f46");
  grad.addColorStop(1, "#047857");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const glow = ctx.createRadialGradient(880, 200, 0, 880, 200, 520);
  glow.addColorStop(0, "rgba(245,158,11,0.28)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.textBaseline = "alphabetic";

  // Brand mark.
  ctx.font = "64px sans-serif";
  ctx.fillText(opts.emoji ?? "💧", 80, 150);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "700 44px sans-serif";
  ctx.fillText("DormDrop", 160, 142);

  // Eyebrow.
  ctx.fillStyle = "rgba(167,243,208,0.9)";
  ctx.font = "600 30px sans-serif";
  ctx.fillText(opts.eyebrow.toUpperCase(), 80, 380);

  // Headline (wrapped).
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 76px sans-serif";
  const lines = wrapText(ctx, opts.headline, SIZE - 160);
  let y = 470;
  for (const line of lines) {
    ctx.fillText(line, 80, y);
    y += 92;
  }

  // Big stat.
  if (opts.stat) {
    ctx.fillStyle = "#fbbf24";
    ctx.font = "800 140px sans-serif";
    ctx.fillText(opts.stat, 80, y + 130);
    y += 130;
  }

  // Subline.
  if (opts.subline) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "400 36px sans-serif";
    for (const line of wrapText(ctx, opts.subline, SIZE - 160)) {
      y += 56;
      ctx.fillText(line, 80, y);
    }
  }

  // Footer.
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 32px sans-serif";
  ctx.fillText("dormdrop.co.uk", 80, SIZE - 70);

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ShareResult = "shared" | "downloaded" | "copied" | "cancelled";

/**
 * Share a generated card + caption. Prefers the native share sheet (with the
 * image where supported); otherwise downloads the image and copies the caption.
 */
export async function shareCard(
  opts: ShareCardOptions,
  caption: string,
): Promise<ShareResult> {
  const blob = await generateShareCard(opts);
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  try {
    if (blob && nav?.canShare) {
      const file = new File([blob], "dormdrop.png", { type: "image/png" });
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text: caption, title: "DormDrop" });
        return "shared";
      }
    }
    if (nav?.share) {
      await nav.share({ text: caption, title: "DormDrop" });
      return "shared";
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "cancelled";
    }
    // fall through to download/copy
  }

  if (blob) downloadBlob(blob, "dormdrop.png");
  try {
    await nav?.clipboard?.writeText(caption);
    return blob ? "downloaded" : "copied";
  } catch {
    return blob ? "downloaded" : "cancelled";
  }
}
