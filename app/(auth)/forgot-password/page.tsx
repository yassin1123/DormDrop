"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createBrowserClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    setError(null);
    setLoading(true);

    const supabase = createBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        // The link lands on /auth/callback, which sets a recovery session and
        // forwards to /reset-password where the new password is set.
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MailCheck className="h-6 w-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Reset link sent
          </h2>
          <p className="max-w-sm text-sm text-slate-500">
            If an account exists for{" "}
            <span className="font-medium text-slate-700">{email}</span>, you&apos;ll
            get an email with a link to set a new password.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="outline" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="you@soton.ac.uk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Send reset link
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Back to login
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
