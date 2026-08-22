import { Boxes, CircleDollarSign, PackageCheck, ShoppingCart } from "lucide-react";

import type { JobMaterial } from "@/lib/job-materials-api";

import { JobMaterialItem } from "./job-material-item";

export function JobMaterialList({
  jobId,
  materials,
  currency,
}: {
  jobId: string;
  materials: JobMaterial[];
  currency: string;
}) {
  const activeMaterials = materials.filter((material) => material.status !== "CANCELLED");

  const estimatedTotalCents = activeMaterials.reduce((total, material) => {
    if (material.estimatedUnitCostCents === null) {
      return total;
    }

    return (
      total + Math.round(Number(material.quantity) * material.estimatedUnitCostCents)
    );
  }, 0);

  const actualTotalCents = activeMaterials.reduce((total, material) => {
    if (material.actualUnitCostCents === null) {
      return total;
    }

    return total + Math.round(Number(material.quantity) * material.actualUnitCostCents);
  }, 0);

  const requiredCount = materials.filter(
    (material) => material.status === "REQUIRED",
  ).length;

  const orderedCount = materials.filter(
    (material) => material.status === "ORDERED",
  ).length;

  const receivedCount = materials.filter(
    (material) => material.status === "RECEIVED",
  ).length;

  const cancelledCount = materials.filter(
    (material) => material.status === "CANCELLED",
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Boxes className="h-4 w-4" />}
          label="Active materials"
          value={String(activeMaterials.length)}
          detail={`${requiredCount} required · ${orderedCount} ordered`}
        />

        <SummaryCard
          icon={<PackageCheck className="h-4 w-4" />}
          label="Received"
          value={String(receivedCount)}
          detail={
            cancelledCount > 0 ? `${cancelledCount} cancelled` : "No cancelled materials"
          }
        />

        <SummaryCard
          icon={<ShoppingCart className="h-4 w-4" />}
          label="Estimated total"
          value={formatMoney(estimatedTotalCents, currency)}
          detail="Active materials"
        />

        <SummaryCard
          icon={<CircleDollarSign className="h-4 w-4" />}
          label="Actual total"
          value={formatMoney(actualTotalCents, currency)}
          detail="Active materials"
        />
      </div>

      {materials.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Boxes className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No materials yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add the materials required for this job to track purchasing, receiving, and
            material costs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {materials.map((material) => (
            <JobMaterialItem
              key={material.id}
              jobId={jobId}
              material={material}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>

      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
