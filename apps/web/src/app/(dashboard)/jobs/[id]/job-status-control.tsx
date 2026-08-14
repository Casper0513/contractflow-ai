"use client";

import { useTransition } from "react";
import { ArrowRight, CheckCircle2, CirclePause, CircleX } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/jobs-api";

import { updateJobStatusAction } from "./status-actions";

type JobStatusControlProps = {
  jobId: string;
  customerId: string;
  status: JobStatus;
  archived: boolean;
};

const workflow: JobStatus[] = [
  "LEAD",
  "ESTIMATING",
  "APPROVED",
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
];

export function JobStatusControl({
  jobId,
  customerId,
  status,
  archived,
}: JobStatusControlProps) {
  const [pending, startTransition] = useTransition();

  if (archived) {
    return null;
  }

  const currentWorkflowIndex = workflow.indexOf(status);

  const nextStatus =
    currentWorkflowIndex >= 0 && currentWorkflowIndex < workflow.length - 1
      ? workflow[currentWorkflowIndex + 1]
      : null;

  function changeStatus(next: JobStatus) {
    if (pending || next === status) {
      return;
    }

    startTransition(async () => {
      await updateJobStatusAction(jobId, customerId, next);
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <p className="font-semibold">Job workflow</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Current status:{" "}
            <span className="font-medium text-foreground">{formatStatus(status)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {nextStatus && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => changeStatus(nextStatus)}
            >
              {nextStatus === "COMPLETED" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}

              {pending ? "Updating..." : `Move to ${formatStatus(nextStatus)}`}
            </Button>
          )}

          {status === "ON_HOLD" && (
            <Button
              type="button"
              disabled={pending}
              onClick={() => changeStatus("IN_PROGRESS")}
            >
              <ArrowRight className="h-4 w-4" />
              Resume job
            </Button>
          )}

          {status !== "ON_HOLD" && status !== "COMPLETED" && status !== "CANCELLED" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeStatus("ON_HOLD")}
            >
              <CirclePause className="h-4 w-4" />
              Put on hold
            </Button>
          )}

          {status !== "CANCELLED" && status !== "COMPLETED" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeStatus("CANCELLED")}
            >
              <CircleX className="h-4 w-4" />
              Cancel job
            </Button>
          )}

          {status === "CANCELLED" && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeStatus("LEAD")}
            >
              <ArrowRight className="h-4 w-4" />
              Reopen as lead
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max items-center gap-2">
          {workflow.map((workflowStatus, index) => {
            const active = workflowStatus === status;

            const completed = currentWorkflowIndex > index;

            return (
              <div key={workflowStatus} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => changeStatus(workflowStatus)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : completed
                        ? "border-green-500/30 bg-green-500/10 text-green-700"
                        : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {formatStatus(workflowStatus)}
                </button>

                {index < workflow.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatStatus(status: JobStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
