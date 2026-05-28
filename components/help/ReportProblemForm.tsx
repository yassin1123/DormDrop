"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export function ReportProblemForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit.");
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-soft">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h3 className="font-display text-lg font-bold text-stone-900">
          Thanks — we&apos;re on it
        </h3>
        <p className="text-sm text-stone-500">
          We&apos;ve logged your report and will be in touch at{" "}
          <span className="font-medium text-stone-700">{email}</span>.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-soft"
      noValidate
    >
      <Input
        label="Your email"
        type="email"
        inputMode="email"
        required
        placeholder="you@soton.ac.uk"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        label="Subject"
        required
        placeholder="e.g. Order didn't arrive"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <Textarea
        label="What went wrong?"
        required
        rows={4}
        placeholder="Tell us what happened and we'll look into it."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button type="submit" className="w-full" isLoading={submitting}>
        Send report
      </Button>
    </form>
  );
}
