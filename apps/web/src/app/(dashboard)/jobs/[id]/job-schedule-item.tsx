"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CircleCheck,
  CirclePause,
  MapPin,
  Pencil,
  RotateCcw,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  JobSchedule,
  JobScheduleStatus,
  JobScheduleType,
} from "@/lib/job-schedules-api";

import { JobScheduleCrewManager } from "./job-schedule-crew-manager";
import { JobScheduleEditForm } from "./job-schedule-edit-form";
import {
  cancelScheduleAction,
  restoreScheduleAction,
  updateScheduleStatusAction,
} from "./schedule-actions";

type JobScheduleItemProps = {
  jobId: string;
  customerId: string;
  schedule: JobSchedule;
};

export function JobScheduleItem({ jobId, customerId, schedule }: JobScheduleItemProps) {
  const [editing, setEditing] = useState(false);

  const [pending, startTransition] = useTransition();

  const cancelled = schedule.status === "CANCELLED";

  function changeStatus(status: JobScheduleStatus) {
    if (pending || status === schedule.status) {
      return;
    }

    startTransition(async () => {
      await updateScheduleStatusAction(jobId, customerId, schedule.id, status);
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        cancelled ? "bg-muted/20 opacity-75" : "bg-background"
      }`}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ScheduleTypeBadge type={schedule.type} />

            <p className="font-medium">{schedule.title}</p>

            <ScheduleStatusBadge status={schedule.status} />
          </div>

          {schedule.description && (
            <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
          )}

          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />

              <span>{formatScheduleRange(schedule)}</span>
            </div>

            {schedule.location && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />

                <span>{schedule.location}</span>
              </div>
            )}

            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0" />

              <span>{formatCrewSummary(schedule)}</span>
            </div>
          </div>

          {schedule.notes && (
            <div className="mt-3 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
              {schedule.notes}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!cancelled && (
            <select
              value={schedule.status}
              disabled={pending}
              onChange={(event) => changeStatus(event.target.value as JobScheduleStatus)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="SCHEDULED">Scheduled</option>

              <option value="IN_PROGRESS">In progress</option>

              <option value="COMPLETED">Completed</option>
            </select>
          )}

          {!cancelled && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditing((current) => !current)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}

          {cancelled ? (
            <form
              action={restoreScheduleAction.bind(null, jobId, customerId, schedule.id)}
            >
              <Button type="submit" size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            </form>
          ) : (
            <form
              action={cancelScheduleAction.bind(null, jobId, customerId, schedule.id)}
            >
              <Button type="submit" size="sm" variant="outline">
                <XCircle className="h-4 w-4" />
                Cancel
              </Button>
            </form>
          )}
        </div>
      </div>

      <JobScheduleCrewManager jobId={jobId} schedule={schedule} />

      {editing && !cancelled && (
        <JobScheduleEditForm
          jobId={jobId}
          customerId={customerId}
          schedule={schedule}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function ScheduleTypeBadge({ type }: { type: JobScheduleType }) {
  const styles: Record<JobScheduleType, string> = {
    WORK: "border-blue-500/30 bg-blue-500/10 text-blue-600",

    SITE_VISIT: "border-violet-500/30 bg-violet-500/10 text-violet-600",

    ESTIMATE: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",

    INSPECTION: "border-amber-500/30 bg-amber-500/10 text-amber-700",

    DELIVERY: "border-orange-500/30 bg-orange-500/10 text-orange-700",

    MEETING: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700",

    OTHER: "border-muted bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[type]}`}
    >
      {formatEnumLabel(type)}
    </span>
  );
}

function ScheduleStatusBadge({ status }: { status: JobScheduleStatus }) {
  const styles: Record<JobScheduleStatus, string> = {
    SCHEDULED: "border-blue-500/30 bg-blue-500/10 text-blue-600",

    IN_PROGRESS: "border-amber-500/30 bg-amber-500/10 text-amber-700",

    COMPLETED: "border-green-500/30 bg-green-500/10 text-green-700",

    CANCELLED: "border-red-500/30 bg-red-500/10 text-red-600",
  };

  const icons: Record<JobScheduleStatus, typeof CalendarDays> = {
    SCHEDULED: CalendarDays,
    IN_PROGRESS: CirclePause,
    COMPLETED: CircleCheck,
    CANCELLED: XCircle,
  };

  const Icon = icons[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <Icon className="h-3 w-3" />

      {formatEnumLabel(status)}
    </span>
  );
}

function formatScheduleRange(schedule: JobSchedule) {
  const start = new Date(schedule.startAt);

  const end = schedule.endAt ? new Date(schedule.endAt) : null;

  if (schedule.allDay) {
    const startLabel = start.toLocaleDateString();

    if (!end) {
      return `${startLabel} · All day`;
    }

    return `${startLabel} – ${end.toLocaleDateString()} · All day`;
  }

  const startLabel = start.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (!end) {
    return startLabel;
  }

  return `${startLabel} – ${end.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function formatCrewSummary(schedule: JobSchedule) {
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
