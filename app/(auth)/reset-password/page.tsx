"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

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

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);

    // The recovery session was established by /auth/callback before this page.
    const supabase = createBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(
        updateError.message.includes("session")
          ? "Your reset link has expired. Request a new one."
          : updateError.message,
      );
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    // Brief confirmation, then on to the app.
    setTimeout(() => {
      router.replace("/requester");
      router.refresh();
    }, 1200);
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Password updated
          </h2>
          <p className="text-sm text-slate-500">Taking you to DormDrop…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Update password
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
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
