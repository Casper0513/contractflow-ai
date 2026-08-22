"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  createJobMaterialAction,
  type JobMaterialActionState,
} from "./job-material-actions";
import { JOB_MATERIAL_UNITS } from "./job-material-options";

const initialState: JobMaterialActionState = {
  error: null,
  success: false,
};

export function JobMaterialForm({ jobId }: { jobId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState(
    createJobMaterialAction.bind(null, jobId),
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
        <Field label="Material">
          <Input
            name="name"
            placeholder="2x4 lumber, drywall, concrete..."
            required
            disabled={pending}
          />
        </Field>

        <Field label="Quantity">
          <Input
            name="quantity"
            type="number"
            inputMode="decimal"
            min="0.001"
            step="0.001"
            defaultValue="1"
            required
            disabled={pending}
          />
        </Field>

        <Field label="Unit">
          <select
            name="unit"
            defaultValue="EACH"
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {JOB_MATERIAL_UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Supplier">
          <Input name="supplier" placeholder="Optional" disabled={pending} />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Estimated unit cost">
          <Input
            name="estimatedUnitCost"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={pending}
          />
        </Field>

        <Field label="Actual unit cost">
          <Input
            name="actualUnitCost"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={pending}
          />
        </Field>

        <Field label="Customer unit price">
          <Input
            name="billableUnitPrice"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="SKU">
          <Input name="sku" placeholder="Optional" disabled={pending} />
        </Field>

        <Field label="Reference">
          <Input
            name="reference"
            placeholder="PO or supplier reference"
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Description">
          <Input
            name="description"
            placeholder="Optional description"
            disabled={pending}
          />
        </Field>

        <Field label="Notes">
          <Input name="notes" placeholder="Optional notes" disabled={pending} />
        </Field>
      </div>

      {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" />

          {pending ? "Adding..." : "Add material"}
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
