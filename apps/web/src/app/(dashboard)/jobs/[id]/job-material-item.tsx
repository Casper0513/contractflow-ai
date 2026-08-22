"use client";

import { useActionState, useEffect, useState } from "react";
import { Ban, PackageCheck, Pencil, RotateCcw, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobMaterial } from "@/lib/job-materials-api";

import {
  cancelJobMaterialAction,
  deleteJobMaterialAction,
  type JobMaterialActionState,
  orderJobMaterialAction,
  receiveJobMaterialAction,
  restoreJobMaterialAction,
  updateJobMaterialAction,
} from "./job-material-actions";
import {
  getJobMaterialStatusLabel,
  getJobMaterialUnitLabel,
  JOB_MATERIAL_UNITS,
} from "./job-material-options";

const initialState: JobMaterialActionState = {
  error: null,
  success: false,
};

export function JobMaterialItem({
  jobId,
  material,
  currency,
}: {
  jobId: string;
  material: JobMaterial;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <JobMaterialEditForm jobId={jobId} material={material} setEditing={setEditing} />
    );
  }

  const estimatedTotal =
    material.estimatedUnitCostCents === null
      ? null
      : Math.round(Number(material.quantity) * material.estimatedUnitCostCents);

  const actualTotal =
    material.actualUnitCostCents === null
      ? null
      : Math.round(Number(material.quantity) * material.actualUnitCostCents);

  const billableTotal =
    material.billableUnitPriceCents === null
      ? null
      : Math.round(Number(material.quantity) * material.billableUnitPriceCents);

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PackageCheck className="h-4 w-4 text-muted-foreground" />

            <p className="font-medium">{material.name}</p>

            <StatusBadge status={material.status} />
          </div>

          {material.description && (
            <p className="mt-2 text-sm text-muted-foreground">{material.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {formatQuantity(material.quantity)} {getJobMaterialUnitLabel(material.unit)}
            </span>

            {material.supplier && <span>Supplier: {material.supplier}</span>}

            {material.sku && <span>SKU: {material.sku}</span>}

            {material.reference && <span>Ref: {material.reference}</span>}
          </div>

          {material.notes && (
            <p className="mt-2 text-sm text-muted-foreground">{material.notes}</p>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <ValueCard
              label="Est. unit"
              value={
                material.estimatedUnitCostCents === null
                  ? "—"
                  : formatMoney(material.estimatedUnitCostCents, currency)
              }
            />

            <ValueCard
              label="Est. total"
              value={
                estimatedTotal === null ? "—" : formatMoney(estimatedTotal, currency)
              }
            />

            <ValueCard
              label="Actual unit"
              value={
                material.actualUnitCostCents === null
                  ? "—"
                  : formatMoney(material.actualUnitCostCents, currency)
              }
            />

            <ValueCard
              label="Actual total"
              value={actualTotal === null ? "—" : formatMoney(actualTotal, currency)}
            />

            <ValueCard
              label="Customer unit"
              value={
                material.billableUnitPriceCents === null
                  ? "—"
                  : formatMoney(material.billableUnitPriceCents, currency)
              }
            />

            <ValueCard
              label="Billable total"
              value={billableTotal === null ? "—" : formatMoney(billableTotal, currency)}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {material.orderedAt && (
              <span>Ordered {formatDateTime(material.orderedAt)}</span>
            )}

            {material.receivedAt && (
              <span>Received {formatDateTime(material.receivedAt)}</span>
            )}

            {material.createdBy && <span>Added by {formatUser(material.createdBy)}</span>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LifecycleActions jobId={jobId} material={material} />

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          <DeleteMaterialButton jobId={jobId} material={material} />
        </div>
      </div>
    </div>
  );
}

function JobMaterialEditForm({
  jobId,
  material,
  setEditing,
}: {
  jobId: string;
  material: JobMaterial;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  /*
   * Freeze the values used as uncontrolled input defaults for the
   * lifetime of this edit session.
   *
   * revalidatePath() can cause an updated material prop to arrive
   * before this component unmounts. Base UI warns if an uncontrolled
   * FieldControl receives a different defaultValue after initialization.
   */
  const [initialMaterial] = useState(material);

  const [state, formAction, pending] = useActionState(
    updateJobMaterialAction.bind(null, jobId, initialMaterial.id),
    initialState,
  );

  useEffect(() => {
    if (state.success) {
      setEditing(false);
    }
  }, [state.success, setEditing]);

  return (
    <form action={formAction} className="rounded-xl border bg-muted/20 p-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Material">
          <Input
            name="name"
            defaultValue={initialMaterial.name}
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
            defaultValue={formatQuantityForInput(initialMaterial.quantity)}
            required
            disabled={pending}
          />
        </Field>

        <Field label="Unit">
          <select
            name="unit"
            defaultValue={initialMaterial.unit}
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
          <Input
            name="supplier"
            defaultValue={initialMaterial.supplier ?? ""}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Estimated unit cost">
          <Input
            name="estimatedUnitCost"
            type="text"
            inputMode="decimal"
            defaultValue={centsForInput(initialMaterial.estimatedUnitCostCents)}
            placeholder="0.00"
            disabled={pending}
          />
        </Field>

        <Field label="Actual unit cost">
          <Input
            name="actualUnitCost"
            type="text"
            inputMode="decimal"
            defaultValue={centsForInput(initialMaterial.actualUnitCostCents)}
            placeholder="0.00"
            disabled={pending}
          />
        </Field>

        <Field label="Customer unit price">
          <Input
            name="billableUnitPrice"
            type="text"
            inputMode="decimal"
            defaultValue={centsForInput(initialMaterial.billableUnitPriceCents)}
            placeholder="0.00"
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="SKU">
          <Input name="sku" defaultValue={initialMaterial.sku ?? ""} disabled={pending} />
        </Field>

        <Field label="Reference">
          <Input
            name="reference"
            defaultValue={initialMaterial.reference ?? ""}
            disabled={pending}
          />
        </Field>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Description">
          <Input
            name="description"
            defaultValue={initialMaterial.description ?? ""}
            disabled={pending}
          />
        </Field>

        <Field label="Notes">
          <Input
            name="notes"
            defaultValue={initialMaterial.notes ?? ""}
            disabled={pending}
          />
        </Field>
      </div>

      {state.error && <p className="mt-4 text-sm text-red-600">{state.error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>

        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function LifecycleActions({ jobId, material }: { jobId: string; material: JobMaterial }) {
  if (material.status === "REQUIRED") {
    return (
      <>
        <MaterialActionButton
          action={orderJobMaterialAction.bind(null, jobId, material.id)}
          label="Order"
          pendingLabel="Ordering..."
          icon={<ShoppingCart className="h-4 w-4" />}
        />

        <MaterialActionButton
          action={receiveJobMaterialAction.bind(null, jobId, material.id)}
          label="Receive"
          pendingLabel="Receiving..."
          icon={<PackageCheck className="h-4 w-4" />}
        />

        <MaterialActionButton
          action={cancelJobMaterialAction.bind(null, jobId, material.id)}
          label="Cancel"
          pendingLabel="Cancelling..."
          icon={<Ban className="h-4 w-4" />}
        />
      </>
    );
  }

  if (material.status === "ORDERED") {
    return (
      <>
        <MaterialActionButton
          action={receiveJobMaterialAction.bind(null, jobId, material.id)}
          label="Receive"
          pendingLabel="Receiving..."
          icon={<PackageCheck className="h-4 w-4" />}
        />

        <MaterialActionButton
          action={cancelJobMaterialAction.bind(null, jobId, material.id)}
          label="Cancel"
          pendingLabel="Cancelling..."
          icon={<Ban className="h-4 w-4" />}
        />
      </>
    );
  }

  if (material.status === "CANCELLED") {
    return (
      <MaterialActionButton
        action={restoreJobMaterialAction.bind(null, jobId, material.id)}
        label="Restore"
        pendingLabel="Restoring..."
        icon={<RotateCcw className="h-4 w-4" />}
      />
    );
  }

  return null;
}

function MaterialActionButton({
  action,
  label,
  pendingLabel,
  icon,
}: {
  action: (previousState: JobMaterialActionState) => Promise<JobMaterialActionState>;
  label: string;
  pendingLabel: string;
  icon: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {icon}

        {pending ? pendingLabel : label}
      </Button>

      {state.error && <p className="mt-2 max-w-52 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function DeleteMaterialButton({
  jobId,
  material,
}: {
  jobId: string;
  material: JobMaterial;
}) {
  const [state, formAction, pending] = useActionState(
    deleteJobMaterialAction.bind(null, jobId, material.id),
    initialState,
  );

  return (
    <form action={formAction}>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={pending}
        aria-label={`Delete ${material.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {state.error && <p className="mt-2 max-w-52 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function StatusBadge({ status }: { status: JobMaterial["status"] }) {
  const styles: Record<JobMaterial["status"], string> = {
    REQUIRED: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    ORDERED: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    RECEIVED: "border-green-500/30 bg-green-500/10 text-green-700",
    CANCELLED: "border-zinc-500/30 bg-zinc-500/10 text-zinc-600",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {getJobMaterialStatusLabel(status)}
    </span>
  );
}

function ValueCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>

      <p className="mt-1 font-medium tabular-nums">{value}</p>
    </div>
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

function formatQuantity(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: 3,
  }).format(number);
}

function formatQuantityForInput(value: string) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return value;
  }

  return String(number);
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function centsForInput(cents: number | null) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatUser(user: {
  firstName: string | null;
  lastName: string | null;
  email: string;
}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || user.email;
}
