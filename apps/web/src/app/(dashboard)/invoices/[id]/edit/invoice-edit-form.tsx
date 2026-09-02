"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleDollarSign, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/customers-api";
import type { Invoice } from "@/lib/invoices-api";
import type { Job } from "@/lib/jobs-api";
import {
  formatMinorAmount,
  getCurrencyInputStep,
  majorToMinor,
  minorToMajorInputValue,
} from "@/lib/money";

import { type UpdateInvoiceState, updateInvoiceAction } from "./actions";

type InvoiceEditFormProps = {
  invoice: Invoice;
  customers: Customer[];
  jobs: Job[];
};

type LineItemDraft = {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

const initialState: UpdateInvoiceState = {
  error: null,
};

export function InvoiceEditForm({ invoice, customers, jobs }: InvoiceEditFormProps) {
  const [customerId, setCustomerId] = useState(invoice.customerId);

  const [jobId, setJobId] = useState(invoice.jobId ?? "");

  const [discount, setDiscount] = useState(
    minorToMajorInputValue(invoice.discountCents, invoice.currency),
  );

  const [taxPercent, setTaxPercent] = useState(taxRateToPercentInput(invoice.taxRate));

  const [nextLineItemId, setNextLineItemId] = useState(1);

  const [lineItems, setLineItems] = useState<LineItemDraft[]>(
    invoice.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: minorToMajorInputValue(item.unitPriceCents, invoice.currency),
    })),
  );

  const boundAction = updateInvoiceAction.bind(null, invoice.id);

  const [state, formAction] = useActionState(boundAction, initialState);

  const customerJobs = useMemo(
    () => jobs.filter((job) => job.customerId === customerId),
    [customerId, jobs],
  );

  const totals = useMemo(
    () => calculatePreviewTotals(lineItems, discount, taxPercent, invoice.currency),
    [lineItems, discount, taxPercent, invoice.currency],
  );

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (!jobs.some((job) => job.id === jobId && job.customerId === value)) {
      setJobId("");
    }
  }

  function addLineItem() {
    const id = `new-${nextLineItemId}`;

    setNextLineItemId((current) => current + 1);

    setLineItems((current) => [
      ...current,
      {
        id,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
      },
    ]);
  }

  function removeLineItem(id: string) {
    setLineItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  function updateLineItem(
    id: string,
    field: "description" | "quantity" | "unitPrice",
    value: string,
  ) {
    setLineItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  const serializedLineItems = JSON.stringify(
    lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: majorToMinor(safeNumber(item.unitPrice), invoice.currency),
    })),
  );

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="lineItems" value={serializedLineItems} />
      <input
        type="hidden"
        name="discountCents"
        value={Math.max(majorToMinor(safeNumber(discount), invoice.currency), 0)}
      />

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Invoice details</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Update the customer, job, dates, and invoice settings.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldContainer label="Customer">
            <select
              name="customerId"
              required
              value={customerId}
              onChange={(event) => handleCustomerChange(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select customer</option>

              {customers.map((customer) => {
                const name = [customer.firstName, customer.lastName]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <option key={customer.id} value={customer.id}>
                    {customer.companyName ? `${name} — ${customer.companyName}` : name}
                  </option>
                );
              })}
            </select>
          </FieldContainer>

          <FieldContainer label="Job">
            <select
              name="jobId"
              value={jobId}
              onChange={(event) => setJobId(event.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">No job</option>

              {customerJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>

            {customerId.length > 0 && customerJobs.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                This customer has no active jobs. The invoice can still be saved without
                one.
              </p>
            )}
          </FieldContainer>
        </div>

        <FieldContainer label="Invoice title">
          <Input
            name="title"
            defaultValue={invoice.title ?? ""}
            placeholder="Final project invoice"
          />
        </FieldContainer>

        <div className="grid gap-5 sm:grid-cols-3">
          <FieldContainer label="Issue date">
            <Input
              name="issueDate"
              type="date"
              defaultValue={toDateInputValue(invoice.issueDate)}
              required
            />
          </FieldContainer>

          <FieldContainer label="Due date">
            <Input
              name="dueDate"
              type="date"
              defaultValue={toDateInputValue(invoice.dueDate)}
            />
          </FieldContainer>

          <FieldContainer label="Tax rate (%)">
            <Input
              name="taxPercent"
              type="number"
              min="0"
              max="100"
              step="0.0001"
              value={taxPercent}
              onChange={(event) => setTaxPercent(event.target.value)}
            />
          </FieldContainer>
        </div>
      </section>

      <section className="space-y-5 border-t pt-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h2 className="text-lg font-semibold">Line items</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Update the work, materials, and services in this invoice.
            </p>
          </div>

          <Button type="button" variant="outline" onClick={addLineItem}>
            <Plus className="h-4 w-4" />
            Add item
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_160px_150px_44px] gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Description</span>

            <span>Quantity</span>

            <span>Unit price</span>

            <span className="text-right">Total</span>

            <span />
          </div>

          <div className="divide-y">
            {lineItems.map((item, index) => {
              const lineTotal = calculateLineTotalCents(item, invoice.currency);

              return (
                <div
                  key={item.id}
                  className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_160px_150px_44px] md:items-center"
                >
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground md:hidden">
                      Description
                    </label>

                    <Input
                      value={item.description}
                      onChange={(event) =>
                        updateLineItem(item.id, "description", event.target.value)
                      }
                      placeholder={`Item ${index + 1}`}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground md:hidden">
                      Quantity
                    </label>

                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={item.quantity}
                      onChange={(event) =>
                        updateLineItem(item.id, "quantity", event.target.value)
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground md:hidden">
                      Unit price
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        {invoice.currency}
                      </span>

                      <Input
                        type="number"
                        min="0"
                        step={getCurrencyInputStep(invoice.currency)}
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateLineItem(item.id, "unitPrice", event.target.value)
                        }
                        className="pl-14"
                        required
                      />
                    </div>
                  </div>

                  <div className="md:text-right">
                    <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                      Total
                    </span>

                    <span className="font-medium tabular-nums">
                      {formatMinorAmount(lineTotal, invoice.currency)}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={lineItems.length === 1}
                      onClick={() => removeLineItem(item.id)}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 border-t pt-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <FieldContainer label="Notes">
            <textarea
              name="notes"
              rows={4}
              defaultValue={invoice.notes ?? ""}
              placeholder="Customer-facing invoice notes..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </FieldContainer>

          <FieldContainer label="Terms">
            <textarea
              name="terms"
              rows={4}
              defaultValue={invoice.terms ?? ""}
              placeholder="Payment terms and conditions..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </FieldContainer>
        </div>

        <div className="h-fit rounded-xl border bg-muted/20 p-5">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />

            <h2 className="font-semibold">Invoice total</h2>
          </div>

          <div className="mt-5 space-y-3">
            <MoneyRow
              label="Subtotal"
              cents={totals.subtotalCents}
              currency={invoice.currency}
            />

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="discount" className="text-sm text-muted-foreground">
                Discount
              </label>

              <div className="relative w-32">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {invoice.currency}
                </span>

                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min="0"
                  step={getCurrencyInputStep(invoice.currency)}
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className="pl-14 text-right"
                />
              </div>
            </div>

            <MoneyRow
              label={`Tax (${formatPercent(totals.taxPercent)})`}
              cents={totals.taxCents}
              currency={invoice.currency}
            />

            <div className="border-t pt-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Total</span>

                <span className="text-2xl font-bold tracking-tight tabular-nums">
                  {formatMinorAmount(totals.totalCents, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            This is a live preview. The API recalculates authoritative totals when the
            invoice is saved.
          </p>
        </div>
      </section>

      <div className="flex justify-end border-t pt-6">
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving changes..." : "Save changes"}
    </Button>
  );
}

function FieldContainer({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>

      {children}
    </label>
  );
}

function MoneyRow({
  label,
  cents,
  currency,
}: {
  label: string;
  cents: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>

      <span className="font-medium tabular-nums">
        {formatMinorAmount(cents, currency)}
      </span>
    </div>
  );
}

function calculatePreviewTotals(
  lineItems: LineItemDraft[],
  discountValue: string,
  taxPercentValue: string,
  currency: string,
) {
  const subtotalCents = lineItems.reduce(
    (total, item) => total + calculateLineTotalCents(item, currency),
    0,
  );

  const discountCents = Math.max(majorToMinor(safeNumber(discountValue), currency), 0);

  const taxableCents = Math.max(subtotalCents - discountCents, 0);

  const taxPercent = Math.max(safeNumber(taxPercentValue), 0);

  const taxCents = Math.round(taxableCents * (taxPercent / 100));

  return {
    subtotalCents,
    taxPercent,
    taxCents,

    totalCents: taxableCents + taxCents,
  };
}

function calculateLineTotalCents(item: LineItemDraft, currency: string) {
  const quantity = Math.max(safeNumber(item.quantity), 0);

  const unitPriceCents = Math.max(majorToMinor(safeNumber(item.unitPrice), currency), 0);

  return Math.round(quantity * unitPriceCents);
}

function safeNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function taxRateToPercentInput(value: string) {
  const rate = Number(value);

  if (!Number.isFinite(rate)) {
    return "0";
  }

  return String(rate * 100);
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 4,
  }).format(value);
}
