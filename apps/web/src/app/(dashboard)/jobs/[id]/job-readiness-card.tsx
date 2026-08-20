import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  ReceiptText,
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

import type { JobReadiness } from "./job-readiness";

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
            value={
              readiness.hasPaidInvoice
                ? "Paid invoice"
                : readiness.hasActiveInvoice
                  ? "Invoice created"
                  : "No invoice"
            }
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Active task completion</span>

            <span className="font-medium">{readiness.taskProgress}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${readiness.taskProgress}%`,
              }}
            />
          </div>
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
                  All active tasks are complete and there are no outstanding scheduled
                  events.
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

  return (
    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />

        <div>
          <p className="font-medium text-green-700">Job completed</p>

          <p className="mt-1 text-sm text-muted-foreground">
            {readiness.hasPaidInvoice
              ? "This job has been completed and has a paid invoice."
              : "This job has been completed and billing has already been created."}
          </p>
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

function ReadinessBadge({
  completed,
  cancelled,
  readyToComplete,
  readyToInvoice,
}: {
  completed: boolean;
  cancelled: boolean;
  readyToComplete: boolean;
  readyToInvoice: boolean;
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
    label = "Completed";
    className = "border-green-500/30 bg-green-500/10 text-green-700";
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
