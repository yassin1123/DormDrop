"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { createBrowserClient } from "@/lib/supabase";

export default function SuspendedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    await createBrowserClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-stone-900">
          Account suspended
        </h1>
        <p className="mt-2 text-stone-600">
          Your DormDrop account has been suspended. If you think this is a
          mistake, please get in touch with support.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          isLoading={loading}
          onClick={signOut}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
