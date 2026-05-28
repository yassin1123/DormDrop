import { NextResponse, type NextRequest } from "next/server";

import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { createAdminClient, createRouteClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/report — "Report a problem" submissions. Stores every report (so
 * nothing is lost) and, if a transactional-email provider is configured
 * (RESEND_API_KEY + REPORT_EMAIL_TO), also emails the team. Open to anyone
 * (the /help page is public), so it's rate-limited by IP.
 */
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`report:${ip}`, 5);
  if (!rl.allowed) return tooManyRequests(rl.retryAfter);

  let body: { email?: string; subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = body.email?.trim() ?? "";
  const subject = body.subject?.trim() ?? "";
  const message = body.message?.trim() ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }
  if (subject.length < 2) {
    return NextResponse.json({ error: "Add a short subject." }, { status: 400 });
  }
  if (message.length < 5) {
    return NextResponse.json(
      { error: "Tell us a little more about the problem." },
      { status: 400 },
    );
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Message is too long." }, { status: 400 });
  }

  // Attach the user id if they happen to be signed in.
  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await createRouteClient().auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // anonymous report — fine
  }

  const { error } = await createAdminClient().from("reports").insert({
    user_id: userId,
    email,
    subject,
    message,
  });
  if (error) {
    return NextResponse.json({ error: "Could not submit report." }, {
      status: 500,
    });
  }

  // Optional email notification (no-op unless configured).
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_EMAIL_TO;
  if (apiKey && to) {
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "DormDrop <noreply@dormdrop.co.uk>",
          to: [to],
          reply_to: email,
          subject: `[DormDrop] ${subject}`,
          text: `${message}\n\n— from ${email}${userId ? ` (user ${userId})` : ""}`,
        }),
      });
    } catch {
      // Email failure is non-fatal — the report is already stored.
    }
  }

  return NextResponse.json({ ok: true });
}
