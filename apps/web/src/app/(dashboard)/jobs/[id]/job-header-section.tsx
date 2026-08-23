import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/jobs-api";

import { JobStatusActions } from "./job-status-actions";

type JobHeaderSectionProps = {
  job: Job;
};

export function JobHeaderSection({ job }: JobHeaderSectionProps) {
  return (
    <>
      <Button
        variant="ghost"
        nativeButton={false}
        render={
          <Link href="/jobs">
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Link>
        }
      />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{job.name}</h1>

            <StatusBadge status={job.status} />

            <PriorityBadge priority={job.priority} />

            {job.archivedAt && (
              <span className="rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>

          <p className="mt-2 text-muted-foreground">
            Job workspace and project overview.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/customers/${job.customer.id}`}>View customer</Link>}
          />

          {!job.archivedAt && (
            <Button
              nativeButton={false}
              render={<Link href={`/jobs/${job.id}/edit`}>Edit job</Link>}
            />
          )}

          <JobStatusActions
            jobId={job.id}
            customerId={job.customer.id}
            jobName={job.name}
            archived={Boolean(job.archivedAt)}
          />
        </div>
      </div>

      {job.archivedAt && (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
          <p className="font-medium">Archived job</p>

          <p className="mt-1 text-sm text-muted-foreground">
            This job was archived on {new Date(job.archivedAt).toLocaleDateString()}.
          </p>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: Job["status"] }) {
  const styles: Record<Job["status"], string> = {
    LEAD: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    ESTIMATING: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
    APPROVED: "border-violet-500/30 bg-violet-500/10 text-violet-600",
    SCHEDULED: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    ON_HOLD: "border-orange-500/30 bg-orange-500/10 text-orange-700",
    COMPLETED: "border-green-500/30 bg-green-500/10 text-green-700",
    CANCELLED: "border-red-500/30 bg-red-500/10 text-red-600",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Job["priority"] }) {
  const styles: Record<Job["priority"], string> = {
    LOW: "text-muted-foreground",
    NORMAL: "text-blue-600",
    HIGH: "text-orange-600",
    URGENT: "text-red-600",
  };

  return (
    <span className={`text-xs font-medium ${styles[priority]}`}>
      {formatEnumLabel(priority)}
    </span>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
