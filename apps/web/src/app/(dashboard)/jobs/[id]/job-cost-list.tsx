import { ReceiptText } from "lucide-react";

import type { JobCost } from "@/lib/job-costs-api";

import { JobCostItem } from "./job-cost-item";

export function JobCostList({
  jobId,
  costs,
  currency,
}: {
  jobId: string;
  costs: JobCost[];
  currency: string;
}) {
  if (costs.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No actual costs yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add materials, labor, subcontractors, equipment, permits, travel, and other
            job costs here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {costs.map((cost) => (
        <JobCostItem key={cost.id} jobId={jobId} cost={cost} currency={currency} />
      ))}
    </div>
  );
}
