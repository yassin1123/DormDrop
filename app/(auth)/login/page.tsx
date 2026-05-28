"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

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
import { dashboardPathForRole } from "@/lib/utils";
import type { UserRole } from "@/types";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where the user was headed before being bounced to login (set by middleware).
  const redirectedFrom = searchParams.get("redirectedFrom");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Created here (not at render) so SSR/prerender never needs Supabase env.
    const supabase = createBrowserClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email: email.trim(), password },
    );

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Decide where to land: honour the original destination if there was one,
    // otherwise route by stored role (and to onboarding if it's unfinished).
    const userId = data.user?.id;
    let destination = redirectedFrom ?? "/requester";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, onboarding_completed")
        .eq("id", userId)
        .single();

      if (profile && !profile.onboarding_completed) {
        destination = "/onboarding";
      } else if (profile && !redirectedFrom) {
        destination = dashboardPathForRole(profile.role as UserRole);
      }
    }

    router.replace(destination);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-xl">Welcome back</CardTitle>
        <CardDescription>Log in to order or run deliveries.</CardDescription>
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
          <div>
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="mt-1.5 text-right">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" isLoading={loading}>
            Log in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          New to DormDrop?{" "}
          <Link
            href="/signup"
            className="font-medium text-brand-700 hover:text-brand-800"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary for static generation.
  return (
    <Suspense fallback={<Card className="h-72 animate-pulse" />}>
      <LoginForm />
    </Suspense>
  );
}
