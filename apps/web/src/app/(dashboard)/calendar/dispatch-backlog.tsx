"use client";

import type { DragEvent } from "react";
import {
  CalendarClock,
  CircleAlert,
  GripVertical,
  MapPin,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import type { Job, JobPriority, JobStatus } from "@/lib/jobs-api";

export type DispatchBacklogDragPayload = {
  kind: "backlog";
  jobId: string;
};

type DispatchBacklogProps = {
  jobs: Job[];
  disabled?: boolean;
  onDragStart: (payload: DispatchBacklogDragPayload) => void;
  onDragEnd: () => void;
};

const DRAG_TYPE = "application/x-contractflow-dispatch";

export function DispatchBacklog({
  jobs,
  disabled = false,
  onDragStart,
  onDragEnd,
}: DispatchBacklogProps) {
  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-col gap-2 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />

            <h2 className="font-semibold">Dispatch backlog</h2>

            <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {jobs.length}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Drag a job onto a crew/date cell to schedule it.
          </p>
        </div>

        {jobs.length > 0 ? (
          <p className="text-xs text-muted-foreground">Ready to dispatch</p>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center px-6 py-8 text-center">
          <CalendarClock className="h-8 w-8 text-muted-foreground/50" />

          <p className="mt-3 text-sm font-medium">No jobs waiting for dispatch</p>

          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Approved and active jobs without scheduled work will appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => (
            <BacklogJobCard
              key={job.id}
              job={job}
              disabled={disabled}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BacklogJobCard({
  job,
  disabled,
  onDragStart,
  onDragEnd,
}: {
  job: Job;
  disabled: boolean;
  onDragStart: (payload: DispatchBacklogDragPayload) => void;
  onDragEnd: () => void;
}) {
  const address = formatJobAddress(job);
  const customer = customerName(job);

  const requestedDate = job.startDate
    ? new Date(job.startDate).toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  function startDrag(event: DragEvent<HTMLDivElement>) {
    if (disabled) {
      event.preventDefault();
      return;
    }

    const payload: DispatchBacklogDragPayload = {
      kind: "backlog",
      jobId: job.id,
    };

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", job.name);

    onDragStart(payload);
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={startDrag}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border bg-background p-4 shadow-sm transition-all ${
        disabled
          ? "cursor-default opacity-60"
          : "cursor-grab hover:bg-muted/20 active:cursor-grabbing"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={`/jobs/${job.id}`}
                draggable={false}
                className="block truncate text-sm font-semibold hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                {job.name}
              </Link>

              <p className="mt-1 truncate text-xs text-muted-foreground">{customer}</p>
            </div>

            <PriorityBadge priority={job.priority} />
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              <span>{formatStatus(job.status)}</span>
            </div>

            {requestedDate ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">Requested start: {requestedDate}</span>
              </div>
            ) : null}

            {address ? (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                <span className="line-clamp-2">{address}</span>
              </div>
            ) : null}
          </div>

          {job.priority === "URGENT" ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <CircleAlert className="h-3.5 w-3.5 shrink-0" />
              Urgent dispatch
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: JobPriority }) {
  const styles: Record<JobPriority, string> = {
    LOW: "border-slate-500/20 bg-slate-500/10 text-slate-600",
    NORMAL: "border-blue-500/20 bg-blue-500/10 text-blue-600",
    HIGH: "border-amber-500/20 bg-amber-500/10 text-amber-700",
    URGENT: "border-red-500/20 bg-red-500/10 text-red-600",
  };

  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[priority]}`}
    >
      {formatStatus(priority)}
    </span>
  );
}

function customerName(job: Job) {
  if (job.customer.companyName) {
    return job.customer.companyName;
  }

  const name = [job.customer.firstName, job.customer.lastName].filter(Boolean).join(" ");

  return name || "Customer";
}

function formatJobAddress(job: Job) {
  const street = [job.addressLine1, job.addressLine2].filter(Boolean).join(", ");

  const locality = [job.city, job.province, job.postalCode].filter(Boolean).join(", ");

  return [street, locality].filter(Boolean).join(" · ");
}

function formatStatus(value: JobStatus | JobPriority) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
