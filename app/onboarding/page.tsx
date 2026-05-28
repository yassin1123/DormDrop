"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bike,
  Check,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DELIVERY_ZONES } from "@/lib/constants";
import { createBrowserClient } from "@/lib/supabase";
import { cn, dashboardPathForRole } from "@/lib/utils";
import type { UserRole } from "@/types";

const ROLE_OPTIONS: {
  value: UserRole;
  title: string;
  blurb: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "requester",
    title: "I want to ORDER",
    blurb: "Get snacks & essentials delivered to your room.",
    icon: ShoppingBag,
  },
  {
    value: "runner",
    title: "I want to DELIVER",
    blurb: "Earn money running orders between lectures.",
    icon: Bike,
  },
  {
    value: "both",
    title: "I want to do BOTH",
    blurb: "Order when you need to, deliver when you're free.",
    icon: Sparkles,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole | null>(null);
  const [zone, setZone] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect rules once auth state is known.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (profile?.onboarding_completed) {
      router.replace(dashboardPathForRole(profile.role));
    }
  }, [loading, user, profile, router]);

  // Pre-fill from any partial profile data the trigger created.
  useEffect(() => {
    if (profile) {
      setFullName((prev) => prev || profile.full_name || "");
      setPhone((prev) => prev || profile.phone || "");
      setZone((prev) => prev || profile.delivery_zone || "");
    }
  }, [profile]);

  const firstName = useMemo(
    () => (fullName.trim() ? fullName.trim().split(/\s+/)[0] : null),
    [fullName],
  );

  function validate(): string | null {
    if (fullName.trim().length < 2) return "Please enter your full name.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) return "Please enter a valid phone number.";
    if (!role) return "Pick how you'd like to use DormDrop.";
    if (!zone) return "Choose your hall or area.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user || !role) return;

    setError(null);
    setSubmitting(true);

    const supabase = createBrowserClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        role,
        delivery_zone: zone,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    router.replace(dashboardPathForRole(role));
    router.refresh();
  }

  // While auth resolves (or we're bouncing an already-onboarded user away).
  if (loading || !user || profile?.onboarding_completed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-brand-700" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-900 text-white">
            <Package className="h-6 w-6" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-slate-900">
            {firstName ? `Welcome, ${firstName}!` : "Let's set you up"}
          </h1>
          <p className="mt-1 text-slate-500">
            A few quick details and you&apos;re in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div className="space-y-4">
            <Input
              label="Full name"
              required
              placeholder="Ada Lovelace"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <Input
              label="Phone number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="07700 900000"
              hint="So your runner can reach you at the door."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {/* Role selection — big tappable cards */}
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              How do you want to use DormDrop?
            </p>
            <div className="grid gap-3">
              {ROLE_OPTIONS.map((opt) => {
                const selected = role === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    aria-pressed={selected}
                    className={cn(
                      "press flex items-center gap-4 rounded-2xl border-2 bg-white p-4 text-left transition-all",
                      selected
                        ? "border-brand-700 bg-brand-50/60 ring-2 ring-brand-700/15"
                        : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                        selected
                          ? "bg-brand-900 text-white"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold text-slate-900">
                        {opt.title}
                      </span>
                      <span className="block text-sm text-slate-500">
                        {opt.blurb}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        selected
                          ? "border-brand-700 bg-brand-700 text-white"
                          : "border-slate-300 text-transparent",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <Select
            label="Your hall / area"
            placeholder="Select your delivery zone"
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            options={DELIVERY_ZONES.map((z) => ({ value: z, label: z }))}
          />

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={submitting}
            rightIcon={<ArrowRight className="h-4 w-4" />}
          >
            Finish setup
          </Button>
        </form>
      </div>
    </div>
  );
}
