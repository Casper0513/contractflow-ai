"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CirclePause,
  CircleX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobStatus } from "@/lib/jobs-api";

import type { JobReadiness } from "./job-readiness";
import { updateJobStatusAction } from "./status-actions";

type JobStatusControlProps = {
  jobId: string;
  customerId: string;
  status: JobStatus;
  archived: boolean;

  readiness: JobReadiness;
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
  readiness,
}: JobStatusControlProps) {
  const [pending, startTransition] = useTransition();

  const [completionBlocked, setCompletionBlocked] = useState(false);

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

    /*
     * Completion is the one guarded transition.
     *
     * Users may continue moving between the other workflow
     * states normally, but a job cannot be marked complete
     * while active work or scheduled events remain.
     */
    if (next === "COMPLETED" && !readiness.readyToComplete) {
      setCompletionBlocked(true);

      return;
    }

    setCompletionBlocked(false);

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

      {completionBlocked && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

            <div className="min-w-0">
              <p className="font-medium text-amber-700">Job is not ready to complete</p>

              <p className="mt-1 text-sm text-muted-foreground">
                Finish or cancel the remaining work before marking this job completed.
              </p>

              {readiness.completionBlockers.length > 0 && (
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
              )}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max items-center gap-2">
          {workflow.map((workflowStatus, index) => {
            const active = workflowStatus === status;

            const completed = currentWorkflowIndex > index;

            const completionLocked =
              workflowStatus === "COMPLETED" &&
              status !== "COMPLETED" &&
              !readiness.readyToComplete;

            return (
              <div key={workflowStatus} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => changeStatus(workflowStatus)}
                  aria-disabled={completionLocked || undefined}
                  title={
                    completionLocked
                      ? "Complete all active work before marking the job completed."
                      : undefined
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : completed
                        ? "border-green-500/30 bg-green-500/10 text-green-700"
                        : completionLocked
                          ? "border-amber-500/30 bg-amber-500/5 text-amber-700"
                          : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {formatStatus(workflowStatus)}

                  {completionLocked && (
                    <span className="sr-only"> — completion requirements remain</span>
                  )}
                </button>

                {index < workflow.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {status !== "COMPLETED" && !readiness.readyToComplete && (
        <p className="mt-4 text-xs text-muted-foreground">
          Completion is protected until all active tasks and outstanding scheduled events
          are resolved.
        </p>
      )}
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
