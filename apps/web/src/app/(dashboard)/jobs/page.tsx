import Link from "next/link";
import {
  Archive,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  MapPin,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getJobs, type Job } from "@/lib/jobs-api";
import { formatMinorAmount } from "@/lib/money";

type JobsPageProps = {
  searchParams: Promise<{
    archived?: string;
  }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const { archived } = await searchParams;

  const showArchived = archived === "true";

  /*
   * Always fetch archived jobs so dashboard counts remain accurate.
   * The query parameter controls display, not data availability.
   */
  const jobs = await getJobs(true);

  const activeJobs = jobs.filter((job) => !job.archivedAt);

  const archivedJobs = jobs.filter((job) => Boolean(job.archivedAt));

  const scheduledJobs = activeJobs.filter((job) => job.status === "SCHEDULED");

  const inProgressJobs = activeJobs.filter((job) => job.status === "IN_PROGRESS");

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>

          <p className="mt-1 text-muted-foreground">
            Manage scheduled, active, and completed customer jobs.
          </p>
        </div>

        <Button nativeButton={false} render={<Link href="/jobs/new">New job</Link>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Active jobs" value={activeJobs.length} />

        <SummaryCard label="Scheduled" value={scheduledJobs.length} />

        <SummaryCard label="In progress" value={inProgressJobs.length} />

        <SummaryCard label="Archived" value={archivedJobs.length} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Job directory</CardTitle>

              <CardDescription className="mt-1">
                Browse jobs across your customers.
              </CardDescription>
            </div>

            {archivedJobs.length > 0 && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <Link href={showArchived ? "/jobs" : "/jobs?archived=true"}>
                    <Archive className="h-4 w-4" />

                    {showArchived
                      ? "Hide archived"
                      : `Show archived (${archivedJobs.length})`}
                  </Link>
                }
              />
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>{activeJobs.length} active</span>

            <span>{scheduledJobs.length} scheduled</span>

            <span>{inProgressJobs.length} in progress</span>

            <span>{archivedJobs.length} archived</span>
          </div>

          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Active jobs</h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Current jobs available in your active workspace.
              </p>
            </div>

            {activeJobs.length === 0 ? (
              <EmptyJobs />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {activeJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            )}
          </section>

          {showArchived && (
            <section className="space-y-4 border-t pt-8">
              <div>
                <h2 className="text-lg font-semibold">Archived jobs</h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Open an archived job to review it or restore it to the active workspace.
                </p>
              </div>

              {archivedJobs.length === 0 ? (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed">
                  <div className="px-6 text-center">
                    <Archive className="mx-auto h-8 w-8 text-muted-foreground" />

                    <p className="mt-3 font-medium">No archived jobs</p>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Archived jobs will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {archivedJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const customerName = [job.customer.firstName, job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const address = [job.addressLine1, job.city, job.province].filter(Boolean).join(", ");

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={`group block rounded-xl border bg-card p-5 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm ${
        job.archivedAt ? "border-dashed opacity-75" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{job.name}</h2>

            <StatusBadge status={job.status} />

            <PriorityBadge priority={job.priority} />

            {job.archivedAt && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Archived
              </span>
            )}
          </div>

          {job.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {job.description}
            </p>
          )}
        </div>

        <BriefcaseBusiness className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-5 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0" />

          <span className="truncate">{customerName}</span>
        </div>

        {job.customer.companyName && (
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0" />

            <span className="truncate">{job.customer.companyName}</span>
          </div>
        )}

        {address && (
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />

            <span className="truncate">{address}</span>
          </div>
        )}

        {job.startDate && (
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0" />

            <span>{new Date(job.startDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t pt-3 text-xs text-muted-foreground">
        <span>
          {job.archivedAt
            ? `Archived ${new Date(job.archivedAt).toLocaleDateString()}`
            : `Created ${new Date(job.createdAt).toLocaleDateString()}`}
        </span>

        {job.budgetCents !== null && (
          <span className="font-medium text-foreground">
            {formatMinorAmount(job.budgetCents, job.currency)}
          </span>
        )}
      </div>

      {job.archivedAt && (
        <p className="mt-3 text-xs font-medium text-foreground">Open job to restore</p>
      )}
    </Link>
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
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
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

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>

        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyJobs() {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <BriefcaseBusiness className="mx-auto h-9 w-9 text-muted-foreground" />

        <p className="mt-3 font-medium">No active jobs</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Create your first job and connect it to a customer.
        </p>

        <Button
          className="mt-4"
          nativeButton={false}
          render={<Link href="/jobs/new">Create job</Link>}
        />
      </div>
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
