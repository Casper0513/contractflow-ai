"use client";

import { Clock, Users } from "lucide-react";

import type { JobSchedule, JobScheduleType } from "@/lib/job-schedules-api";

type CalendarEventProps = {
  schedule: JobSchedule;
  compact?: boolean;
  onClick: (schedule: JobSchedule) => void;
};

export function CalendarEvent({
  schedule,
  compact = false,
  onClick,
}: CalendarEventProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(schedule)}
      title={buildEventTitle(schedule)}
      className={`block w-full min-w-0 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-muted/70 ${
        typeStyles[schedule.type]
      }`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {!schedule.allDay && <Clock className="h-3 w-3 shrink-0" />}

        <span className="truncate text-xs font-medium">
          {schedule.allDay ? "All day" : formatTime(schedule.startAt)}
        </span>

        <span className="truncate text-xs">{schedule.title}</span>
      </div>

      {!compact && (
        <>
          <div className="mt-1 truncate text-[11px] opacity-75">{schedule.job.name}</div>

          <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] opacity-75">
            <Users className="h-3 w-3 shrink-0" />

            <span className="truncate">{formatCrew(schedule)}</span>
          </div>
        </>
      )}
    </button>
  );
}

const typeStyles: Record<JobScheduleType, string> = {
  WORK: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",

  SITE_VISIT:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",

  ESTIMATE: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",

  INSPECTION: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",

  DELIVERY: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",

  MEETING: "border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300",

  OTHER: "border-border bg-muted/50 text-muted-foreground",
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCrew(schedule: JobSchedule) {
  if (schedule.crewMembers.length === 0) {
    return "Unassigned";
  }

  return schedule.crewMembers
    .map((assignment) =>
      [assignment.crewMember.firstName, assignment.crewMember.lastName]
        .filter(Boolean)
        .join(" "),
    )
    .join(", ");
}

function buildEventTitle(schedule: JobSchedule) {
  const customerName = [schedule.job.customer.firstName, schedule.job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  return [
    schedule.title,
    schedule.job.name,
    customerName,
    formatCrew(schedule),
    schedule.location,
  ]
    .filter(Boolean)
    .join(" · ");
}
