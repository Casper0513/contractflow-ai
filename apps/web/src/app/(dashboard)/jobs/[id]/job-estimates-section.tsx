import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Estimate } from "@/lib/estimates-api";

type JobEstimatesSectionProps = {
  jobId: string;
  customerId: string;
  archived: boolean;
  estimates: Estimate[];
};

export function JobEstimatesSection({
  jobId,
  customerId,
  archived,
  estimates,
}: JobEstimatesSectionProps) {
  const draftEstimates = estimates.filter((estimate) => estimate.status === "DRAFT");

  const activeEstimates = estimates.filter(
    (estimate) => estimate.status === "SENT" || estimate.status === "VIEWED",
  );

  const approvedEstimates = estimates.filter(
    (estimate) => estimate.status === "APPROVED",
  );

  const approvedEstimateValue = approvedEstimates.reduce(
    (total, estimate) => total + estimate.totalCents,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Estimates</CardTitle>

            <CardDescription className="mt-1">
              Quotes and pricing prepared for this job.
            </CardDescription>
          </div>

          {!archived && (
            <Button
              size="sm"
              nativeButton={false}
              render={
                <Link href={`/estimates/new?customerId=${customerId}&jobId=${jobId}`}>
                  <Plus className="h-4 w-4" />
                  New estimate
                </Link>
              }
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceSummaryItem label="Total estimates" value={estimates.length} />

          <WorkspaceSummaryItem label="Draft" value={draftEstimates.length} />

          <WorkspaceSummaryItem label="Sent / viewed" value={activeEstimates.length} />

          <WorkspaceSummaryItem
            label="Approved value"
            value={formatMoney(approvedEstimateValue)}
          />
        </div>

        {estimates.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
            <div className="max-w-sm px-6 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground" />

              <p className="mt-3 font-medium">No estimates yet</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Create an estimate for this job to start tracking quoted work and pricing.
              </p>

              {!archived && (
                <Button
                  className="mt-4"
                  size="sm"
                  nativeButton={false}
                  render={
                    <Link href={`/estimates/new?customerId=${customerId}&jobId=${jobId}`}>
                      <Plus className="h-4 w-4" />
                      Create estimate
                    </Link>
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {estimates.map((estimate) => (
              <JobEstimateRow key={estimate.id} estimate={estimate} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobEstimateRow({ estimate }: { estimate: Estimate }) {
  return (
    <Link
      href={`/estimates/${estimate.id}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 sm:flex-row sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />

          <span className="font-semibold">{estimate.number}</span>

          <EstimateStatusBadge status={estimate.status} />
        </div>

        <p className="mt-2 truncate text-sm">{estimate.title || "Untitled estimate"}</p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Created {new Date(estimate.createdAt).toLocaleDateString()}</span>

          <span>
            {estimate.lineItems.length} item
            {estimate.lineItems.length === 1 ? "" : "s"}
          </span>

          {estimate.validUntil && (
            <span>Valid until {new Date(estimate.validUntil).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      <div className="shrink-0 text-left sm:text-right">
        <p className="text-lg font-semibold tabular-nums">
          {formatMoney(estimate.totalCents)}
        </p>

        <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">
          View estimate
        </p>
      </div>
    </Link>
  );
}

function EstimateStatusBadge({ status }: { status: Estimate["status"] }) {
  const styles: Record<Estimate["status"], string> = {
    DRAFT: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    SENT: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    VIEWED: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
    APPROVED: "border-green-500/30 bg-green-500/10 text-green-700",
    DECLINED: "border-red-500/30 bg-red-500/10 text-red-600",
    EXPIRED: "border-orange-500/30 bg-orange-500/10 text-orange-700",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function WorkspaceSummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}
