import { formatMinorAmount } from "@/lib/money";
import {
  CircleDollarSign,
  Landmark,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { JobCost, JobCostCategory, JobCostSummary } from "@/lib/job-costs-api";

import { JobCostForm } from "./job-cost-form";
import { JOB_COST_CATEGORIES } from "./job-cost-options";
import { JobCostList } from "./job-cost-list";

export function JobFinancials({
  jobId,
  costs,
  summary,
  currency,
}: {
  jobId: string;
  costs: JobCost[];
  summary: JobCostSummary;
  currency: string;
}) {
  const profitable = summary.grossProfitCents >= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FinancialMetric
          label="Budget"
          value={
            summary.budgetCents !== null
              ? formatMinorAmount(summary.budgetCents, currency)
              : "Not set"
          }
          description="Approved job value"
          icon={Landmark}
        />

        <FinancialMetric
          label="Actual cost"
          value={formatMinorAmount(summary.actualCostCents, currency)}
          description={`${costs.length} cost ${costs.length === 1 ? "entry" : "entries"}`}
          icon={ReceiptText}
        />

        <FinancialMetric
          label="Invoiced revenue"
          value={formatMinorAmount(summary.invoicedRevenueCents, currency)}
          description="Sent and active invoices"
          icon={WalletCards}
        />

        <FinancialMetric
          label="Collected"
          value={formatMinorAmount(summary.collectedRevenueCents, currency)}
          description="Recorded customer payments"
          icon={CircleDollarSign}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Budget variance</p>

            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${
                summary.budgetVarianceCents !== null && summary.budgetVarianceCents < 0
                  ? "text-red-600"
                  : ""
              }`}
            >
              {summary.budgetVarianceCents !== null
                ? formatSignedMoney(summary.budgetVarianceCents, currency)
                : "—"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">Budget minus actual cost</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Gross profit</p>

                <p
                  className={`mt-2 text-2xl font-semibold tabular-nums ${
                    profitable ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {formatMinorAmount(summary.grossProfitCents, currency)}
                </p>
              </div>

              {profitable ? (
                <TrendingUp className="h-5 w-5 text-green-700" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Invoiced revenue minus actual cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Gross margin</p>

            <p
              className={`mt-2 text-2xl font-semibold tabular-nums ${
                summary.grossMarginPercent !== null && summary.grossMarginPercent < 0
                  ? "text-red-600"
                  : ""
              }`}
            >
              {summary.grossMarginPercent !== null
                ? `${summary.grossMarginPercent.toFixed(1)}%`
                : "—"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Profit as a percentage of invoiced revenue
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-3">
          <h3 className="font-semibold">Cost breakdown</h3>

          <p className="text-sm text-muted-foreground">
            Actual costs grouped by category.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JOB_COST_CATEGORIES.map((category) => (
            <CategoryTotal
              key={category.value}
              category={category.value}
              label={category.label}
              amountCents={summary.categoryTotals[category.value]}
              totalCents={summary.actualCostCents}
              currency={currency}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3">
          <h3 className="font-semibold">Add actual cost</h3>

          <p className="text-sm text-muted-foreground">
            Record money spent performing this job.
          </p>
        </div>

        <JobCostForm jobId={jobId} currency={currency} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Cost history</h3>

            <p className="text-sm text-muted-foreground">
              Individual costs recorded against this job.
            </p>
          </div>

          <p className="text-sm font-medium tabular-nums">
            {formatMinorAmount(summary.actualCostCents, currency)}
          </p>
        </div>

        <JobCostList jobId={jobId} costs={costs} currency={currency} />
      </div>
    </div>
  );
}

function FinancialMetric({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof ReceiptText;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{label}</p>

          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>

        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function CategoryTotal({
  category,
  label,
  amountCents,
  totalCents,
  currency,
}: {
  category: JobCostCategory;
  label: string;
  amountCents: number;
  totalCents: number;
  currency: string;
}) {
  const percentage = totalCents > 0 ? (amountCents / totalCents) * 100 : 0;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>

        <span className="text-xs text-muted-foreground">{percentage.toFixed(0)}%</span>
      </div>

      <p className="mt-2 font-semibold tabular-nums">
        {formatMinorAmount(amountCents, currency)}
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60"
          style={{
            width: `${Math.min(100, Math.max(0, percentage))}%`,
          }}
        />
      </div>

      <span className="sr-only">{category}</span>
    </div>
  );
}

function formatSignedMoney(cents: number, currency: string) {
  const absolute = formatMinorAmount(Math.abs(cents), currency);

  if (cents > 0) {
    return `+${absolute}`;
  }

  if (cents < 0) {
    return `-${absolute}`;
  }

  return absolute;
}
