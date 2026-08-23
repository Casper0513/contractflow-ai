import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobSchedule } from "@/lib/job-schedules-api";

import { JobScheduleForm } from "./job-schedule-form";
import { JobScheduleList } from "./job-schedule-list";

type JobScheduleSectionProps = {
  jobId: string;
  customerId: string;
  archived: boolean;
  schedules: JobSchedule[];
};

export function JobScheduleSection({
  jobId,
  customerId,
  archived,
  schedules,
}: JobScheduleSectionProps) {
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

        {!archived && <JobScheduleForm jobId={jobId} customerId={customerId} />}

        <JobScheduleList jobId={jobId} customerId={customerId} schedules={schedules} />
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
