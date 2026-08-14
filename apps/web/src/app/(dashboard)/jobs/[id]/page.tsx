import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CircleDollarSign,
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
import { getJobSchedules } from "@/lib/job-schedules-api";
import { getJobTasks } from "@/lib/job-tasks-api";
import { getJob, type Job } from "@/lib/jobs-api";

import { JobScheduleForm } from "./job-schedule-form";
import { JobScheduleList } from "./job-schedule-list";
import { JobStatusActions } from "./job-status-actions";
import { JobStatusControl } from "./job-status-control";
import { JobTaskForm } from "./job-task-form";
import { JobTaskList } from "./job-task-list";

type JobDetailsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const { id } = await params;

  const [job, tasks, schedules] = await Promise.all([
    getJob(id),
    getJobTasks(id),
    getJobSchedules(id, true),
  ]);

  const customerName = [job.customer.firstName, job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  const fullAddress = [
    job.addressLine1,
    job.addressLine2,
    job.city,
    job.province,
    job.postalCode,
    job.country,
  ]
    .filter(Boolean)
    .join(", ");

  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;

  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const activeSchedules = schedules.filter(
    (schedule) => schedule.status === "SCHEDULED" || schedule.status === "IN_PROGRESS",
  );

  const completedSchedules = schedules.filter(
    (schedule) => schedule.status === "COMPLETED",
  );

  const cancelledSchedules = schedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  const nextSchedule =
    activeSchedules.length > 0
      ? [...activeSchedules].sort(
          (first, second) =>
            new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
        )[0]
      : null;

  return (
    <div className="space-y-8">
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

      <JobStatusControl
        jobId={job.id}
        customerId={job.customer.id}
        status={job.status}
        archived={Boolean(job.archivedAt)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Customer" value={customerName} icon={UserRound} />

        <SummaryItem
          label="Start date"
          value={
            job.startDate ? new Date(job.startDate).toLocaleDateString() : "Not scheduled"
          }
          icon={CalendarDays}
        />

        <SummaryItem
          label="Budget"
          value={job.budgetCents !== null ? formatMoney(job.budgetCents) : "Not set"}
          icon={CircleDollarSign}
        />

        <SummaryItem label="Location" value={job.city ?? "Not set"} icon={MapPin} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job overview</CardTitle>

            <CardDescription>Scope and project information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <InfoRow label="Status" value={formatEnumLabel(job.status)} />

            <InfoRow label="Priority" value={formatEnumLabel(job.priority)} />

            <InfoRow
              label="Description"
              value={job.description ?? "No description yet."}
            />

            <InfoRow
              label="Created"
              value={new Date(job.createdAt).toLocaleDateString()}
            />

            <InfoRow
              label="Last updated"
              value={new Date(job.updatedAt).toLocaleDateString()}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer & location</CardTitle>

            <CardDescription>Customer and job-site information.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <div>
                <p className="font-medium">{customerName}</p>

                {job.customer.companyName && (
                  <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />

                    {job.customer.companyName}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />

              <p className="text-sm">{fullAddress || "No job-site address yet."}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Schedule</CardTitle>

              <CardDescription className="mt-1">
                Plan work, site visits, inspections, deliveries, and meetings.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {activeSchedules.length} upcoming
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ScheduleSummaryItem label="Upcoming" value={activeSchedules.length} />

            <ScheduleSummaryItem label="Completed" value={completedSchedules.length} />

            <ScheduleSummaryItem label="Cancelled" value={cancelledSchedules.length} />

            <ScheduleSummaryItem
              label="Next event"
              value={
                nextSchedule
                  ? formatScheduleSummary(nextSchedule.startAt, nextSchedule.allDay)
                  : "None scheduled"
              }
            />
          </div>

          {!job.archivedAt && (
            <JobScheduleForm jobId={job.id} customerId={job.customer.id} />
          )}

          <JobScheduleList
            jobId={job.id}
            customerId={job.customer.id}
            schedules={schedules}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <CardTitle>Tasks</CardTitle>

              <CardDescription className="mt-1">
                Track the work required to complete this job.
              </CardDescription>
            </div>

            <div className="text-sm text-muted-foreground">
              {completedTasks} of {tasks.length} complete
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>

              <span className="font-medium">{taskProgress}%</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${taskProgress}%`,
                }}
              />
            </div>
          </div>

          {!job.archivedAt && <JobTaskForm jobId={job.id} customerId={job.customer.id} />}

          <JobTaskList jobId={job.id} customerId={job.customer.id} tasks={tasks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>

          <CardDescription>
            These sections will become the core of the remaining job workflow.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {["Crew", "Materials", "Photos", "Documents", "Estimates", "Invoices"].map(
              (item) => (
                <div key={item} className="rounded-xl border bg-muted/20 p-4">
                  <p className="font-medium">{item}</p>

                  <p className="mt-1 text-sm text-muted-foreground">Coming soon</p>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof UserRound;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 truncate font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ScheduleSummaryItem({
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>

      <p className="mt-1 whitespace-pre-wrap">{value}</p>
    </div>
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

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function formatScheduleSummary(value: string, allDay: boolean) {
  const date = new Date(value);

  if (allDay) {
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
