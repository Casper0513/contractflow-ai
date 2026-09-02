"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrencyInputStep, minorToMajorInputValue } from "@/lib/money";
import { JOB_COST_CATEGORIES } from "./job-cost-options";
import { createJobCostAction, type CreateJobCostState } from "./job-cost-actions";

const initialState: CreateJobCostState = {
  error: null,
  success: false,
};

export function JobCostForm({ jobId, currency }: { jobId: string; currency: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    createJobCostAction.bind(null, jobId),
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="rounded-xl border bg-muted/20 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Category">
          <select
            name="category"
            defaultValue="MATERIAL"
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
            placeholder="Lumber, electrician, permit..."
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
            placeholder={minorToMajorInputValue(0, currency)}
            required
            disabled={pending}
          />
        </Field>

        <Field label="Date">
          <Input
            name="incurredAt"
            type="date"
            defaultValue={todayForDateInput()}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Vendor">
          <Input name="vendor" placeholder="Optional" disabled={pending} />
        </Field>

        <Field label="Reference">
          <Input name="reference" placeholder="Receipt or PO number" disabled={pending} />
        </Field>

        <Field label="Notes">
          <Input name="notes" placeholder="Optional notes" disabled={pending} />
        </Field>
      </div>

      {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />

          {pending ? "Adding..." : "Add cost"}
        </Button>
      </div>
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

function todayForDateInput() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
