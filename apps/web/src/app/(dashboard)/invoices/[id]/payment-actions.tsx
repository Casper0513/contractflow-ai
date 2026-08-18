"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { voidInvoicePaymentAction } from "./actions";

type PaymentActionsProps = {
  invoiceId: string;
  paymentId: string;
};

export function PaymentActions({ invoiceId, paymentId }: PaymentActionsProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  function voidPayment() {
    setError(null);

    startTransition(async () => {
      const result = await voidInvoicePaymentAction(invoiceId, paymentId);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={voidPayment}
      >
        <Undo2 className="h-4 w-4" />

        {isPending ? "Voiding..." : "Void payment"}
      </Button>

      {error && <p className="max-w-xs text-xs text-destructive">{error}</p>}
    </div>
  );
}
