"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InvoiceStatus, PaymentMethod } from "@/lib/invoices-api";
import {
  formatMinorAmount,
  getCurrencyInputStep,
  majorToMinor,
  minorToMajorInputValue,
} from "@/lib/money";

import { recordInvoicePaymentAction, type InvoiceActionState } from "./actions";

type RecordPaymentFormProps = {
  invoiceId: string;
  status: InvoiceStatus;
  balanceDueCents: number;
  currency: string;
};

const initialState: InvoiceActionState = {
  error: null,
  success: null,
};

export function RecordPaymentForm({
  invoiceId,
  status,
  balanceDueCents,
  currency,
}: RecordPaymentFormProps) {
  const [amount, setAmount] = useState(minorToMajorInputValue(balanceDueCents, currency));

  const amountCents = parsePaymentAmountToMinor(amount, currency);

  const boundAction = recordInvoicePaymentAction.bind(null, invoiceId);

  const [state, formAction] = useActionState(boundAction, initialState);

  /*
   * The invoice can refresh after recording or voiding a
   * payment. Keep the controlled Amount field synchronized
   * with the latest outstanding balance.
   */

  const canAcceptPayment =
    status === "SENT" ||
    status === "VIEWED" ||
    status === "PARTIALLY_PAID" ||
    status === "OVERDUE";

  if (!canAcceptPayment) {
    return null;
  }

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <WalletCards className="h-5 w-5 text-muted-foreground" />

          <h3 className="font-semibold">Record payment</h3>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Current balance:{" "}
          <span className="font-medium text-foreground">
            {formatMinorAmount(balanceDueCents, currency)}
          </span>
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
          {state.success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {currency}
            </span>

            <Input
              name="amount"
              type="number"
              min={getCurrencyInputStep(currency)}
              step={getCurrencyInputStep(currency)}
              max={minorToMajorInputValue(balanceDueCents, currency)}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="pl-14"
              required
            />

            <input type="hidden" name="amountCents" value={amountCents} />
          </div>
        </Field>

        <Field label="Payment method">
          <select
            name="method"
            defaultValue="E_TRANSFER"
            required
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PAYMENT_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Received date">
          <Input name="receivedAt" type="date" />
        </Field>

        <Field label="Reference">
          <Input name="reference" placeholder="Transaction or cheque number" />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Optional payment notes..."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </Field>

      <div className="flex justify-end">
        <SubmitPaymentButton />
      </div>
    </form>
  );
}

function SubmitPaymentButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <WalletCards className="h-4 w-4" />

      {pending ? "Recording payment..." : "Record payment"}
    </Button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>

      {children}
    </label>
  );
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  {
    value: "E_TRANSFER",
    label: "E-Transfer",
  },
  {
    value: "CREDIT_CARD",
    label: "Credit card",
  },
  {
    value: "DEBIT_CARD",
    label: "Debit card",
  },
  {
    value: "CASH",
    label: "Cash",
  },
  {
    value: "CHEQUE",
    label: "Cheque",
  },
  {
    value: "BANK_TRANSFER",
    label: "Bank transfer",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

function parsePaymentAmountToMinor(value: string, currency: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return 0;
  }

  return majorToMinor(amount, currency);
}
