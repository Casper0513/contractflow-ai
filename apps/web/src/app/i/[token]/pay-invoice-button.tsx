"use client";

import { CreditCard } from "lucide-react";
import { useState, useTransition } from "react";

type PayInvoiceButtonProps = {
  token: string;
  balanceDueCents: number;
  currency: string;
};

export function PayInvoiceButton({
  token,
  balanceDueCents,
  currency,
}: PayInvoiceButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function payInvoice() {
    setError(null);

    startTransition(async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setError("Payment configuration is unavailable.");
        return;
      }

      try {
        const response = await fetch(
          `${apiUrl}/public/invoices/${encodeURIComponent(token)}/checkout`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) {
          const body = await response.text();

          let message = "Unable to start payment. Please try again.";

          try {
            const parsed = JSON.parse(body) as {
              message?: unknown;
            };

            if (typeof parsed.message === "string") {
              message = parsed.message;
            }
          } catch {
            // Response was not JSON.
          }

          setError(message);
          return;
        }

        const result = (await response.json()) as {
          url?: unknown;
        };

        if (typeof result.url !== "string" || !result.url) {
          setError("Stripe did not return a Checkout URL.");
          return;
        }

        window.location.assign(result.url);
      } catch (error) {
        console.error("Unable to start Stripe Checkout", error);

        setError("Unable to start payment. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={isPending || balanceDueCents <= 0}
        onClick={payInvoice}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CreditCard className="h-4 w-4" />

        {isPending
          ? "Opening checkout..."
          : `Pay ${formatMoney(balanceDueCents, currency)}`}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
