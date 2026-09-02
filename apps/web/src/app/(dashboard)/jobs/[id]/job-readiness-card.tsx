import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  ReceiptText,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobStatus } from "@/lib/jobs-api";
import { formatCurrencyMinorAmounts } from "@/lib/money";

import type { JobBillingStatus, JobReadiness } from "./job-readiness";

type JobReadinessCardProps = {
  jobId: string;
  customerId: string;
  status: JobStatus;
  archived: boolean;
  readiness: JobReadiness;
};

export function JobReadinessCard({
  jobId,
  customerId,
  status,
  archived,
  readiness,
}: JobReadinessCardProps) {
  const completed = status === "COMPLETED";
  const cancelled = status === "CANCELLED";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Job readiness</CardTitle>

            <CardDescription className="mt-1">
              Review outstanding work before completing and billing this job.
            </CardDescription>
          </div>

          <ReadinessBadge
            completed={completed}
            cancelled={cancelled}
            readyToComplete={readiness.readyToComplete}
            readyToInvoice={readiness.readyToInvoice}
            billingStatus={readiness.billingStatus}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReadinessMetric
            icon={ClipboardCheck}
            label="Tasks"
            value={
              readiness.activeTaskCount === 0
                ? "No active tasks"
                : `${readiness.completedTaskCount} / ${readiness.activeTaskCount} complete`
            }
          />

          <ReadinessMetric
            icon={AlertTriangle}
            label="Blocked"
            value={String(readiness.blockedTaskCount)}
          />

          <ReadinessMetric
            icon={CalendarClock}
            label="Outstanding schedule"
            value={String(readiness.activeScheduleCount)}
          />

          <ReadinessMetric
            icon={ReceiptText}
            label="Billing"
            value={getBillingMetricLabel(readiness)}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <ProgressMetric label="Active task completion" value={readiness.taskProgress} />

          <ProgressMetric
            label="Checklist completion"
            value={readiness.checklistProgress}
          />
        </div>

        {cancelled ? (
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

              <div>
                <p className="font-medium">Job cancelled</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Completion readiness is not evaluated while this job is cancelled.
                </p>
              </div>
            </div>
          </div>
        ) : completed ? (
          <CompletedJobState
            jobId={jobId}
            customerId={customerId}
            archived={archived}
            readiness={readiness}
          />
        ) : readiness.readyToComplete ? (
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

              <div>
                <p className="font-medium text-green-700">Ready to complete</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  All active tasks, outstanding scheduled events, and checklist items are
                  complete.
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  Use the Job workflow control above to mark this job completed.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div className="min-w-0">
                <p className="font-medium text-amber-700">Work remains</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Review these items before completing the job.
                </p>

                <ul className="mt-3 space-y-1.5 text-sm">
                  {readiness.completionBlockers.map((blocker) => (
                    <li key={blocker} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                      />

                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {(readiness.cancelledTaskCount > 0 || readiness.cancelledScheduleCount > 0) && (
          <p className="text-xs text-muted-foreground">
            Cancelled work is excluded from completion readiness (
            {readiness.cancelledTaskCount} cancelled{" "}
            {readiness.cancelledTaskCount === 1 ? "task" : "tasks"},{" "}
            {readiness.cancelledScheduleCount} cancelled{" "}
            {readiness.cancelledScheduleCount === 1 ? "event" : "events"}
            ).
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CompletedJobState({
  jobId,
  customerId,
  archived,
  readiness,
}: {
  jobId: string;
  customerId: string;
  archived: boolean;
  readiness: JobReadiness;
}) {
  if (readiness.readyToInvoice) {
    return (
      <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

            <div>
              <p className="font-medium text-blue-700">Ready to invoice</p>

              <p className="mt-1 text-sm text-muted-foreground">
                This job is complete and does not have an active invoice.
              </p>
            </div>
          </div>

          {!archived && (
            <Button
              nativeButton={false}
              render={
                <Link href={`/invoices/new?customerId=${customerId}&jobId=${jobId}`}>
                  <ReceiptText className="h-4 w-4" />
                  Create invoice
                </Link>
              }
            />
          )}
        </div>
      </div>
    );
  }

  if (readiness.billingStatus === "DRAFT") {
    return (
      <BillingStateCard
        icon={ReceiptText}
        title="Invoice draft"
        description={buildInvoiceCountDescription(
          readiness.draftInvoiceCount,
          "draft invoice",
          "draft invoices",
        )}
        tone="slate"
      />
    );
  }

  if (readiness.billingStatus === "AWAITING_PAYMENT") {
    return (
      <BillingStateCard
        icon={Clock3}
        title="Awaiting payment"
        description={`${buildInvoiceCountDescription(
          readiness.outstandingInvoiceCount,
          "invoice is",
          "invoices are",
        )} waiting for customer payment.`}
        tone="blue"
      />
    );
  }

  if (readiness.billingStatus === "PARTIALLY_PAID") {
    return (
      <BillingStateCard
        icon={WalletCards}
        title="Partially paid"
        description={`${formatCurrencyMinorAmounts(
          readiness.totalPaid,
        )} collected with ${formatCurrencyMinorAmounts(readiness.totalBalanceDue)} remaining.`}
        tone="amber"
      />
    );
  }

  if (readiness.billingStatus === "OVERDUE") {
    return (
      <BillingStateCard
        icon={AlertTriangle}
        title="Payment overdue"
        description={`${buildInvoiceCountDescription(
          readiness.overdueInvoiceCount,
          "invoice is",
          "invoices are",
        )} overdue with ${formatCurrencyMinorAmounts(readiness.totalBalanceDue)} outstanding.`}
        tone="red"
      />
    );
  }

  if (readiness.billingStatus === "PAID") {
    return (
      <BillingStateCard
        icon={CheckCircle2}
        title="Paid"
        description={`${formatCurrencyMinorAmounts(
          readiness.totalPaid,
        )} has been collected for this job.`}
        tone="green"
      />
    );
  }

  return (
    <BillingStateCard
      icon={CheckCircle2}
      title="Job completed"
      description="This job has been completed."
      tone="green"
    />
  );
}

function BillingStateCard({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof ReceiptText;
  title: string;
  description: string;
  tone: "slate" | "blue" | "amber" | "red" | "green";
}) {
  const styles = {
    slate: {
      container: "border-slate-500/30 bg-slate-500/5",
      icon: "text-slate-600",
      title: "text-slate-700",
    },
    blue: {
      container: "border-blue-500/30 bg-blue-500/5",
      icon: "text-blue-600",
      title: "text-blue-700",
    },
    amber: {
      container: "border-amber-500/30 bg-amber-500/5",
      icon: "text-amber-600",
      title: "text-amber-700",
    },
    red: {
      container: "border-red-500/30 bg-red-500/5",
      icon: "text-red-600",
      title: "text-red-700",
    },
    green: {
      container: "border-green-500/30 bg-green-500/5",
      icon: "text-green-600",
      title: "text-green-700",
    },
  } as const;

  const style = styles[tone];

  return (
    <div className={`rounded-xl border p-4 ${style.container}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />

        <div>
          <p className={`font-medium ${style.title}`}>{title}</p>

          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ReadinessMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />

        <span className="text-sm">{label}</span>
      </div>

      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>

        <span className="font-medium">{value}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{
            width: `${value}%`,
          }}
        />
      </div>
    </div>
  );
}

function ReadinessBadge({
  completed,
  cancelled,
  readyToComplete,
  readyToInvoice,
  billingStatus,
}: {
  completed: boolean;
  cancelled: boolean;
  readyToComplete: boolean;
  readyToInvoice: boolean;
  billingStatus: JobBillingStatus;
}) {
  let label = "Work remaining";
  let className = "border-amber-500/30 bg-amber-500/10 text-amber-700";

  if (cancelled) {
    label = "Cancelled";
    className = "border-zinc-500/30 bg-zinc-500/10 text-zinc-600";
  } else if (readyToInvoice) {
    label = "Ready to invoice";
    className = "border-blue-500/30 bg-blue-500/10 text-blue-700";
  } else if (completed) {
    const billingBadge = getBillingBadge(billingStatus);

    label = billingBadge.label;
    className = billingBadge.className;
  } else if (readyToComplete) {
    label = "Ready to complete";
    className = "border-green-500/30 bg-green-500/10 text-green-700";
  }

  return (
    <span
      className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function getBillingBadge(status: JobBillingStatus) {
  switch (status) {
    case "DRAFT":
      return {
        label: "Invoice draft",
        className: "border-slate-500/30 bg-slate-500/10 text-slate-600",
      };

    case "AWAITING_PAYMENT":
      return {
        label: "Awaiting payment",
        className: "border-blue-500/30 bg-blue-500/10 text-blue-700",
      };

    case "PARTIALLY_PAID":
      return {
        label: "Partially paid",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-700",
      };

    case "OVERDUE":
      return {
        label: "Payment overdue",
        className: "border-red-500/30 bg-red-500/10 text-red-700",
      };

    case "PAID":
      return {
        label: "Paid",
        className: "border-green-500/30 bg-green-500/10 text-green-700",
      };

    case "NOT_INVOICED":
    default:
      return {
        label: "Completed",
        className: "border-green-500/30 bg-green-500/10 text-green-700",
      };
  }
}

function getBillingMetricLabel(readiness: JobReadiness) {
  switch (readiness.billingStatus) {
    case "DRAFT":
      return `${readiness.draftInvoiceCount} draft`;

    case "AWAITING_PAYMENT":
      return `${readiness.outstandingInvoiceCount} awaiting payment`;

    case "PARTIALLY_PAID":
      return `${formatCurrencyMinorAmounts(readiness.totalBalanceDue)} due`;

    case "OVERDUE":
      return `${formatCurrencyMinorAmounts(readiness.totalBalanceDue)} overdue`;

    case "PAID":
      return "Paid";

    case "NOT_INVOICED":
    default:
      return "No invoice";
  }
}

function buildInvoiceCountDescription(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
