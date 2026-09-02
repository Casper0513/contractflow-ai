"use client";

import { useActionState, useState } from "react";
import { CalendarDays, Pencil, ReceiptText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobCost } from "@/lib/job-costs-api";
import {
  formatMinorAmount,
  getCurrencyInputStep,
  minorToMajorInputValue,
} from "@/lib/money";

import {
  deleteJobCostAction,
  type DeleteJobCostState,
  type UpdateJobCostState,
  updateJobCostAction,
} from "./job-cost-actions";
import { JOB_COST_CATEGORIES } from "./job-cost-options";

const initialUpdateState: UpdateJobCostState = {
  error: null,
  success: false,
};

const initialDeleteState: DeleteJobCostState = {
  error: null,
  success: false,
};

export function JobCostItem({
  jobId,
  cost,
  currency,
}: {
  jobId: string;
  cost: JobCost;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <JobCostEditForm
        jobId={jobId}
        cost={cost}
        currency={currency}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />

            <p className="font-medium">{cost.description}</p>

            <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
              {formatCategory(cost.category)}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {cost.vendor && <span>{cost.vendor}</span>}

            {cost.reference && <span>Ref: {cost.reference}</span>}
          </div>

          {cost.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{cost.notes}</p>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" />

            <span>{formatDate(cost.incurredAt)}</span>

            {cost.createdBy && (
              <>
                <span>•</span>

                <span>Added by {formatUser(cost.createdBy)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-3">
          <p className="min-w-24 text-right text-lg font-semibold tabular-nums">
            {formatMinorAmount(cost.amountCents, currency)}
          </p>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          <DeleteCostButton jobId={jobId} cost={cost} />
        </div>
      </div>
    </div>
  );
}

function JobCostEditForm({
  jobId,
  cost,
  currency,
  onCancel,
}: {
  jobId: string;
  cost: JobCost;
  currency: string;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateJobCostAction.bind(null, jobId, cost.id),
    initialUpdateState,
  );

  if (state.success) {
    return (
      <div className="rounded-xl border bg-muted/20 p-4">
        <p className="text-sm text-muted-foreground">Cost updated.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border bg-muted/20 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Category">
          <select
            name="category"
            defaultValue={cost.category}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {JOB_COST_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description">
          <Input
            name="description"
            defaultValue={cost.description}
            required
            disabled={pending}
          />
        </Field>

        <Field label={`Amount (${currency})`}>
          <Input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0"
            step={getCurrencyInputStep(currency)}
            defaultValue={minorToMajorInputValue(cost.amountCents, currency)}
            required
            disabled={pending}
          />
        </Field>

        <Field label="Date">
          <Input
            name="incurredAt"
            type="date"
            defaultValue={dateForInput(cost.incurredAt)}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Vendor">
          <Input name="vendor" defaultValue={cost.vendor ?? ""} disabled={pending} />
        </Field>

        <Field label="Reference">
          <Input
            name="reference"
            defaultValue={cost.reference ?? ""}
            disabled={pending}
          />
        </Field>

        <Field label="Notes">
          <Input name="notes" defaultValue={cost.notes ?? ""} disabled={pending} />
        </Field>
      </div>

      {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function DeleteCostButton({ jobId, cost }: { jobId: string; cost: JobCost }) {
  const [state, formAction, pending] = useActionState(
    deleteJobCostAction.bind(null, jobId, cost.id),
    initialDeleteState,
  );

  return (
    <form action={formAction}>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Delete ${cost.description}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {state.error && <p className="mt-2 max-w-48 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>

      {children}
    </label>
  );
}

function formatCategory(value: string) {
  const category = JOB_COST_CATEGORIES.find((item) => item.value === value);

  return category?.label ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function dateForInput(value: string) {
  const date = new Date(value);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatUser(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.email;
}
