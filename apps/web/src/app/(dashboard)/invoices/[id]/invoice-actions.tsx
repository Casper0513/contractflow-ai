"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Eye, Pencil, Send, TimerOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/invoices-api";

import { runInvoiceAction, type InvoiceAction } from "./actions";

type InvoiceActionsProps = {
  invoiceId: string;
  status: InvoiceStatus;
  amountPaidCents: number;
};

export function InvoiceActions({
  invoiceId,
  status,
  amountPaidCents,
}: InvoiceActionsProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  function execute(action: InvoiceAction) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await runInvoiceAction(invoiceId, action);

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
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <Link href={`/invoices/${invoiceId}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Edit invoice
                </Link>
              }
            />

            <ActionButton
              label="Send invoice"
              pendingLabel="Sending..."
              icon={Send}
              isPending={isPending}
              onClick={() => execute("send")}
            />

            <ActionButton
              label="Void invoice"
              pendingLabel="Voiding..."
              icon={X}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("void")}
            />
          </>
        )}

        {status === "SENT" && (
          <>
            <ActionButton
              label="Mark viewed"
              pendingLabel="Updating..."
              icon={Eye}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("view")}
            />

            <ActionButton
              label="Mark overdue"
              pendingLabel="Updating..."
              icon={TimerOff}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("overdue")}
            />

            {amountPaidCents === 0 && (
              <ActionButton
                label="Void invoice"
                pendingLabel="Voiding..."
                icon={X}
                variant="outline"
                isPending={isPending}
                onClick={() => execute("void")}
              />
            )}
          </>
        )}

        {status === "VIEWED" && (
          <>
            <ActionButton
              label="Mark overdue"
              pendingLabel="Updating..."
              icon={TimerOff}
              variant="outline"
              isPending={isPending}
              onClick={() => execute("overdue")}
            />

            {amountPaidCents === 0 && (
              <ActionButton
                label="Void invoice"
                pendingLabel="Voiding..."
                icon={X}
                variant="outline"
                isPending={isPending}
                onClick={() => execute("void")}
              />
            )}
          </>
        )}

        {status === "PARTIALLY_PAID" && (
          <ActionButton
            label="Mark overdue"
            pendingLabel="Updating..."
            icon={TimerOff}
            variant="outline"
            isPending={isPending}
            onClick={() => execute("overdue")}
          />
        )}

        {status === "OVERDUE" && amountPaidCents === 0 && (
          <ActionButton
            label="Void invoice"
            pendingLabel="Voiding..."
            icon={X}
            variant="outline"
            isPending={isPending}
            onClick={() => execute("void")}
          />
        )}
      </div>

      {status === "PAID" && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          This invoice has been paid in full.
        </div>
      )}

      {status === "VOIDED" && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          This invoice is voided and is read-only.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{success}</div>
      )}
    </div>
  );
}

type ActionButtonProps = {
  label: string;
  pendingLabel: string;
  icon: typeof Send;
  isPending: boolean;
  onClick: () => void;
  variant?: React.ComponentProps<typeof Button>["variant"];
};

function ActionButton({
  label,
  pendingLabel,
  icon: Icon,
  isPending,
  onClick,
  variant,
}: ActionButtonProps) {
  return (
    <Button type="button" variant={variant} disabled={isPending} onClick={onClick}>
      <Icon className="h-4 w-4" />

      {isPending ? pendingLabel : label}
    </Button>
  );
}
