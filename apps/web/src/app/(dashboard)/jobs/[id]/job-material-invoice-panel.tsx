"use client";

import { formatMinorAmount } from "@/lib/money";
import { useActionState, useMemo, useState } from "react";
import { CheckCircle2, FileText, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Invoice } from "@/lib/invoices-api";
import type { JobMaterial } from "@/lib/job-materials-api";

import {
  addJobMaterialsToInvoiceAction,
  type JobMaterialInvoiceActionState,
} from "./job-material-invoice-actions";
import { getJobMaterialUnitLabel } from "./job-material-options";

const initialState: JobMaterialInvoiceActionState = {
  error: null,
  success: false,
  importedCount: 0,
};

export function JobMaterialInvoicePanel({
  jobId,
  materials,
  invoices,
  currency,
}: {
  jobId: string;
  materials: JobMaterial[];
  invoices: Invoice[];
  currency: string;
}) {
  const draftInvoices = useMemo(
    () =>
      invoices.filter((invoice) => invoice.status === "DRAFT" && invoice.jobId === jobId),
    [invoices, jobId],
  );

  const [invoiceId, setInvoiceId] = useState(draftInvoices[0]?.id ?? "");

  const selectedInvoice =
    draftInvoices.find((invoice) => invoice.id === invoiceId) ?? draftInvoices[0] ?? null;

  const effectiveInvoiceId = selectedInvoice?.id ?? "";

  const importedMaterialIds = useMemo(
    () =>
      new Set(
        selectedInvoice?.lineItems
          .map((lineItem) => lineItem.sourceJobMaterialId)
          .filter((materialId): materialId is string => materialId !== null) ?? [],
      ),
    [selectedInvoice],
  );

  const eligibleMaterials = useMemo(
    () =>
      materials.filter(
        (material) =>
          material.status !== "CANCELLED" &&
          material.billableUnitPriceCents !== null &&
          !importedMaterialIds.has(material.id),
      ),
    [materials, importedMaterialIds],
  );

  const eligibleMaterialIds = useMemo(
    () => new Set(eligibleMaterials.map((material) => material.id)),
    [eligibleMaterials],
  );

  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());

  /*
   * Only currently eligible material IDs count as selected.
   *
   * This keeps selection derived from current invoice/material data
   * without synchronously changing state inside an effect.
   */
  const effectiveSelectedMaterialIds = useMemo(
    () => new Set([...selectedMaterialIds].filter((id) => eligibleMaterialIds.has(id))),
    [selectedMaterialIds, eligibleMaterialIds],
  );

  const [state, formAction, pending] = useActionState(
    addJobMaterialsToInvoiceAction.bind(null, jobId),
    initialState,
  );

  const selectedCount = effectiveSelectedMaterialIds.size;

  const selectedTotalCents = eligibleMaterials.reduce((total, material) => {
    if (
      !effectiveSelectedMaterialIds.has(material.id) ||
      material.billableUnitPriceCents === null
    ) {
      return total;
    }

    return (
      total + Math.round(Number(material.quantity) * material.billableUnitPriceCents)
    );
  }, 0);

  const allEligibleSelected =
    eligibleMaterials.length > 0 &&
    eligibleMaterials.every((material) => effectiveSelectedMaterialIds.has(material.id));

  function toggleMaterial(materialId: string) {
    setSelectedMaterialIds((current) => {
      const next = new Set(current);

      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }

      return next;
    });
  }

  function toggleAllEligible() {
    if (allEligibleSelected) {
      setSelectedMaterialIds(new Set());
      return;
    }

    setSelectedMaterialIds(new Set(eligibleMaterials.map((material) => material.id)));
  }

  function handleInvoiceChange(nextInvoiceId: string) {
    setInvoiceId(nextInvoiceId);
    setSelectedMaterialIds(new Set());
  }

  if (materials.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-muted-foreground" />

            <p className="font-medium">Add materials to invoice</p>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Add customer-priced job materials to an existing draft invoice.
          </p>
        </div>

        {selectedCount > 0 && (
          <div className="text-sm lg:text-right">
            <p className="font-medium">{selectedCount} selected</p>

            <p className="text-muted-foreground">
              {formatMinorAmount(selectedTotalCents, currency)}
            </p>
          </div>
        )}
      </div>

      {draftInvoices.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed p-4">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-muted-foreground" />

            <div>
              <p className="text-sm font-medium">No draft invoice available</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Create a draft invoice for this job before importing materials.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="invoiceId" value={effectiveInvoiceId} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <label className="space-y-2">
              <span className="text-sm font-medium">Draft invoice</span>

              <select
                value={effectiveInvoiceId}
                disabled={pending}
                onChange={(event) => handleInvoiceChange(event.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {draftInvoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.number}
                    {invoice.title ? ` — ${invoice.title}` : ""}
                    {` — ${formatMinorAmount(
                      invoice.totalCents,
                      invoice.currency || currency,
                    )}`}
                  </option>
                ))}
              </select>
            </label>

            <Button
              type="button"
              variant="outline"
              disabled={pending || eligibleMaterials.length === 0}
              onClick={toggleAllEligible}
            >
              {allEligibleSelected ? "Clear selection" : "Select all billable"}
            </Button>
          </div>

          <div className="space-y-2">
            {materials.map((material) => {
              const alreadyImported = importedMaterialIds.has(material.id);

              const cancelled = material.status === "CANCELLED";

              const missingPrice = material.billableUnitPriceCents === null;

              const eligible = !alreadyImported && !cancelled && !missingPrice;

              const selected = effectiveSelectedMaterialIds.has(material.id);

              const billableTotal =
                material.billableUnitPriceCents === null
                  ? null
                  : Math.round(
                      Number(material.quantity) * material.billableUnitPriceCents,
                    );

              return (
                <label
                  key={material.id}
                  className={`flex gap-3 rounded-lg border p-3 ${
                    eligible
                      ? "cursor-pointer bg-background"
                      : "cursor-not-allowed bg-muted/30 opacity-70"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="materialIds"
                    value={material.id}
                    checked={selected}
                    disabled={pending || !eligible}
                    onChange={() => toggleMaterial(material.id)}
                    className="mt-1 h-4 w-4"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{material.name}</span>

                        {alreadyImported && (
                          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3" />
                            Already added
                          </span>
                        )}

                        {cancelled && (
                          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            Cancelled
                          </span>
                        )}

                        {missingPrice && !cancelled && (
                          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                            No customer price
                          </span>
                        )}
                      </div>

                      <span className="font-medium tabular-nums">
                        {billableTotal === null
                          ? "—"
                          : formatMinorAmount(billableTotal, currency)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {formatQuantity(material.quantity)}{" "}
                        {getJobMaterialUnitLabel(material.unit)}
                      </span>

                      {material.billableUnitPriceCents !== null && (
                        <span>
                          {formatMinorAmount(material.billableUnitPriceCents, currency)}{" "}
                          each
                        </span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          {state.success && (
            <p className="text-sm text-green-700">
              {state.importedCount} material
              {state.importedCount === 1 ? "" : "s"} added to the invoice.
            </p>
          )}

          <div className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
            <div className="text-sm text-muted-foreground">
              {selectedCount === 0 ? (
                "Select the materials to add."
              ) : (
                <>
                  {selectedCount} material
                  {selectedCount === 1 ? "" : "s"} ·{" "}
                  {formatMinorAmount(selectedTotalCents, currency)}
                </>
              )}
            </div>

            <Button
              type="submit"
              disabled={pending || !effectiveInvoiceId || selectedCount === 0}
            >
              <ReceiptText className="h-4 w-4" />

              {pending
                ? "Adding..."
                : selectedCount === 0
                  ? "Add to invoice"
                  : `Add ${selectedCount} to invoice`}
            </Button>
          </div>
        </form>
      )}
    </div>
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
