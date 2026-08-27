"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellRing, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { runInvoiceReminderCheckAction } from "./actions";

type RunReminderCheckButtonProps = {
  invoiceId: string;
};

export function RunReminderCheckButton({ invoiceId }: RunReminderCheckButtonProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  function runCheck() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await runInvoiceReminderCheckAction(invoiceId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(result.success);

      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" disabled={isPending} onClick={runCheck}>
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BellRing className="h-4 w-4" />
        )}

        {isPending ? "Checking reminders..." : "Run reminder check"}
      </Button>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {success}
        </div>
      )}
    </div>
  );
}
