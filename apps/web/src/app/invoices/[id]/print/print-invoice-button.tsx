"use client";

import { Download, Mail, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/invoices-api";

import { runInvoiceAction } from "@/app/(dashboard)/invoices/[id]/actions";

type PrintInvoiceButtonProps = {
  invoiceId: string;
  status: InvoiceStatus;
};

export function PrintInvoiceButton({ invoiceId, status }: PrintInvoiceButtonProps) {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState<string | null>(null);

  function sendEmail() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await runInvoiceAction(invoiceId, "send");

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
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={sendEmail}
          >
            <Mail className="h-4 w-4" />

            {isPending ? "Sending..." : "Send Email"}
          </Button>
        )}

        <Button
          variant="outline"
          nativeButton={false}
          render={
            <a href={`/invoices/${invoiceId}/pdf`}>
              <Download className="h-4 w-4" />
              Download PDF
            </a>
          }
        />

        <Button type="button" onClick={() => window.print()} disabled={isPending}>
          <Printer className="h-4 w-4" />
          Print invoice
        </Button>
      </div>

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
