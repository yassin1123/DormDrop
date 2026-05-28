"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";

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

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  function validate(): string | null {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return "Enter your email.";
    if (!trimmed.endsWith("@soton.ac.uk")) {
      return "DormDrop is for Southampton students — sign up with your @soton.ac.uk email.";
    }
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (password !== confirm) return "Passwords don't match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);

    // Created here (not at render) so SSR/prerender never needs Supabase env.
    const supabase = createBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // After confirming their email, send users straight to onboarding.
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // With email confirmation off, a session exists immediately → onboard now.
    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
    } else {
      setNeedsConfirmation(true);
      setLoading(false);
    }
  }

  if (needsConfirmation) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MailCheck className="h-6 w-6" />
          </span>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Check your inbox
          </h2>
          <p className="max-w-sm text-sm text-slate-500">
            We sent a confirmation link to{" "}
            <span className="font-medium text-slate-700">{email}</span>. Tap it
            to activate your account and finish setting up your profile.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="outline">Back to login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">
          Create your account
        </CardTitle>
        <CardDescription>
          Sign up with your email — we&apos;ll set up your profile next.
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
            hint="Southampton students only — use your @soton.ac.uk email."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
