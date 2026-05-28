"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/feedback/ToastProvider";
import { Button } from "@/components/ui/Button";

export function AdminUserActions({
  id,
  isSuspended,
}: {
  id: string;
  isSuspended: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_suspended: !isSuspended }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      toast.success(isSuspended ? "User unsuspended." : "User suspended.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={isSuspended ? "outline" : "danger"}
      isLoading={busy}
      onClick={toggle}
    >
      {isSuspended ? "Unsuspend user" : "Suspend user"}
    </Button>
  );
}
