"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleDollarSign, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Customer } from "@/lib/customers-api";
import type { Job } from "@/lib/jobs-api";

import { createEstimateAction, type CreateEstimateState } from "./actions";

type EstimateFormProps = {
  customers: Customer[];
  jobs: Job[];
  selectedCustomerId?: string;
  selectedJobId?: string;
};

type LineItemDraft = {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
};

const initialState: CreateEstimateState = {
  error: null,
};

export function EstimateForm({
  customers,
  jobs,
  selectedCustomerId,
  selectedJobId,
}: EstimateFormProps) {
  const initialCustomerId = selectedCustomerId ?? "";

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");

  const [jobId, setJobId] = useState(selectedJobId ?? "");

  const [discount, setDiscount] = useState("0");

  const [taxPercent, setTaxPercent] = useState("5");

  const [nextLineItemId, setNextLineItemId] = useState(2);

  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    {
      id: 1,
      description: "",
      quantity: "1",
      unitPrice: "0.00",
    },
  ]);

  const [state, formAction] = useActionState(createEstimateAction, initialState);

  const customerJobs = useMemo(
    () => jobs.filter((job) => job.customerId === customerId),
    [customerId, jobs],
  );

  const totals = useMemo(
    () => calculatePreviewTotals(lineItems, discount, taxPercent),
    [lineItems, discount, taxPercent],
  );

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (!jobs.some((job) => job.id === jobId && job.customerId === value)) {
      setJobId("");
    }
  }

  function addLineItem() {
    setLineItems((current) => [
      ...current,
      {
        id: nextLineItemId,
        description: "",
        quantity: "1",
        unitPrice: "0.00",
      },
    ]);

    setNextLineItemId((current) => current + 1);
  }

  function removeLineItem(id: number) {
    setLineItems((current) =>
      current.length === 1 ? current : current.filter((item) => item.id !== id),
    );
  }

  function updateLineItem(
    id: number,
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
      unitPrice: item.unitPrice,
    })),
  );

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="lineItems" value={serializedLineItems} />

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
          <h2 className="text-lg font-semibold">Estimate details</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Connect the estimate to a customer and optionally a job.
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
                This customer has no active jobs. The estimate can still be created
                without one.
              </p>
            )}
          </FieldContainer>
        </div>

        <FieldContainer label="Estimate title">
          <Input name="title" placeholder="Kitchen renovation estimate" />
        </FieldContainer>

        <div className="grid gap-5 sm:grid-cols-2">
          <FieldContainer label="Valid until">
            <Input name="validUntil" type="date" />
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
              Add the work, materials, or services included in this estimate.
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
              const lineTotal = calculateLineTotalCents(item);

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
                        $
                      </span>

                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateLineItem(item.id, "unitPrice", event.target.value)
                        }
                        className="pl-7"
                        required
                      />
                    </div>
                  </div>

                  <div className="md:text-right">
                    <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                      Total
                    </span>

                    <span className="font-medium tabular-nums">
                      {formatMoney(lineTotal)}
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
          <FieldContainer label="Customer notes">
            <textarea
              name="notes"
              rows={4}
              placeholder="Notes visible with the estimate..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </FieldContainer>

          <FieldContainer label="Terms">
            <textarea
              name="terms"
              rows={4}
              placeholder="Payment terms, exclusions, conditions..."
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </FieldContainer>
        </div>

        <div className="h-fit rounded-xl border bg-muted/20 p-5">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-muted-foreground" />

            <h2 className="font-semibold">Estimate total</h2>
          </div>

          <div className="mt-5 space-y-3">
            <MoneyRow label="Subtotal" cents={totals.subtotalCents} />

            <div className="flex items-center justify-between gap-4">
              <label htmlFor="discount" className="text-sm text-muted-foreground">
                Discount
              </label>

              <div className="relative w-32">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>

                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  className="pl-7 text-right"
                />
              </div>
            </div>

            <MoneyRow
              label={`Tax (${formatPercent(totals.taxPercent)})`}
              cents={totals.taxCents}
            />

            <div className="border-t pt-3">
              <div className="flex items-center justify-between gap-4">
                <span className="font-semibold">Total</span>

                <span className="text-2xl font-bold tracking-tight tabular-nums">
                  {formatMoney(totals.totalCents)}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            This is a live preview. The API recalculates all financial totals when the
            estimate is saved.
          </p>
        </div>
      </section>

      <div className="flex justify-end border-t pt-6">
        <SubmitButton />
      </div>
    </form>
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

function MoneyRow({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>

      <span className="font-medium tabular-nums">{formatMoney(cents)}</span>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating estimate..." : "Save draft estimate"}
    </Button>
  );
}

function calculatePreviewTotals(
  lineItems: LineItemDraft[],
  discountValue: string,
  taxPercentValue: string,
) {
  const subtotalCents = lineItems.reduce(
    (total, item) => total + calculateLineTotalCents(item),
    0,
  );

  const discountCents = Math.max(Math.round(safeNumber(discountValue) * 100), 0);

  const taxableCents = Math.max(subtotalCents - discountCents, 0);

  const taxPercent = Math.max(safeNumber(taxPercentValue), 0);

  const taxCents = Math.round(taxableCents * (taxPercent / 100));

  return {
    subtotalCents,
    discountCents,
    taxPercent,
    taxCents,

    totalCents: taxableCents + taxCents,
  };
}

function calculateLineTotalCents(item: LineItemDraft) {
  const quantity = Math.max(safeNumber(item.quantity), 0);

  const unitPriceCents = Math.max(Math.round(safeNumber(item.unitPrice) * 100), 0);

  return Math.round(quantity * unitPriceCents);
}

function safeNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 4,
  }).format(value);
}
