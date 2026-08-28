"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  RotateCcw,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { JobSchedule } from "@/lib/job-schedules-api";

import {
  cancelCalendarScheduleAction,
  restoreCalendarScheduleAction,
} from "./calendar-schedule-actions";
import { CalendarScheduleCrewManager } from "./calendar-schedule-crew-manager";
import { CalendarScheduleEditForm } from "./calendar-schedule-edit-form";

type CalendarDetailsPanelProps = {
  schedule?: JobSchedule | null;
  daySchedules?: JobSchedule[] | null;
  dayDate?: Date | null;
  onClose: () => void;
};

export function CalendarDetailsPanel({
  schedule,
  daySchedules,
  dayDate,
  onClose,
}: CalendarDetailsPanelProps) {
  const [editing, setEditing] = useState(false);
  const open = Boolean(schedule) || Boolean(daySchedules);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="font-semibold">
              {schedule
                ? editing
                  ? "Edit schedule"
                  : "Schedule event"
                : dayDate
                  ? dayDate.toLocaleDateString("en-CA", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Schedule"}
            </p>

            {!schedule && daySchedules ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {daySchedules.length} event
                {daySchedules.length === 1 ? "" : "s"}
              </p>
            ) : null}
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5">
          {schedule ? (
            editing ? (
              <CalendarScheduleEditForm
                schedule={schedule}
                onCancel={() => setEditing(false)}
                onSaved={onClose}
              />
            ) : (
              <EventDetails
                schedule={schedule}
                onEdit={() => setEditing(true)}
                onChanged={onClose}
              />
            )
          ) : (
            <DayDetails schedules={daySchedules ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

function EventDetails({
  schedule,
  onEdit,
  onChanged,
}: {
  schedule: JobSchedule;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const customerName =
    [schedule.job.customer.firstName, schedule.job.customer.lastName]
      .filter(Boolean)
      .join(" ") ||
    schedule.job.customer.companyName ||
    "Customer";

  const handleChanged = useCallback(() => {
    router.refresh();
    onChanged();
  }, [onChanged, router]);

  function cancelSchedule() {
    setActionError(null);

    startTransition(async () => {
      const result = await cancelCalendarScheduleAction(
        schedule.jobId,
        schedule.job.customer.id,
        schedule.id,
      );

      if (!result.success) {
        setActionError(result.message ?? "Unable to cancel schedule.");
        return;
      }

      handleChanged();
    });
  }

  function restoreSchedule() {
    setActionError(null);

    startTransition(async () => {
      const result = await restoreCalendarScheduleAction(
        schedule.jobId,
        schedule.job.customer.id,
        schedule.id,
      );

      if (!result.success) {
        setActionError(result.message ?? "Unable to restore schedule.");
        return;
      }

      handleChanged();
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={schedule.type} />
          <StatusBadge status={schedule.status} />
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{schedule.title}</h2>

        {schedule.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
        ) : null}
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {actionError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onEdit} disabled={pending}>
          <Pencil className="h-4 w-4" />
          Edit schedule
        </Button>

        {schedule.status === "CANCELLED" ? (
          <Button
            type="button"
            variant="outline"
            onClick={restoreSchedule}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Restore
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={cancelSchedule}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            Cancel event
          </Button>
        )}
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <DetailRow
          icon={CalendarDays}
          label="Date"
          value={formatScheduleRange(schedule)}
        />
        <DetailRow icon={UserRound} label="Customer" value={customerName} />
        <DetailRow icon={CalendarDays} label="Job" value={schedule.job.name} />
        <DetailRow icon={Users} label="Crew" value={formatAssignedCrew(schedule)} />
        {schedule.location ? (
          <DetailRow icon={MapPin} label="Location" value={schedule.location} />
        ) : null}
      </div>

      <CalendarScheduleCrewManager schedule={schedule} onChanged={handleChanged} />

      {schedule.notes ? (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-medium">Notes</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {schedule.notes}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t pt-5">
        <Button
          nativeButton={false}
          render={<Link href={`/jobs/${schedule.jobId}`}>View job</Link>}
        />

        <Button
          variant="outline"
          nativeButton={false}
          render={
            <Link href={`/customers/${schedule.job.customer.id}`}>View customer</Link>
          }
        />
      </div>
    </div>
  );
}

function DayDetails({ schedules }: { schedules: JobSchedule[] }) {
  if (schedules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No schedule events for this day.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={schedule.type} />
            <StatusBadge status={schedule.status} />
          </div>

          <p className="mt-2 font-medium">{schedule.title}</p>

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatScheduleRange(schedule)}</span>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{schedule.job.name}</p>

          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/jobs/${schedule.jobId}`}>View job</Link>}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm">{value}</p>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: JobSchedule["type"] }) {
  return (
    <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium">
      {formatEnumLabel(type)}
    </span>
  );
}

function StatusBadge({ status }: { status: JobSchedule["status"] }) {
  return (
    <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-xs font-medium">
      {formatEnumLabel(status)}
    </span>
  );
}

function formatScheduleRange(schedule: JobSchedule) {
  const start = new Date(schedule.startAt);
  const end = schedule.endAt ? new Date(schedule.endAt) : null;

  if (schedule.allDay) {
    const startLabel = start.toLocaleDateString();

    if (!end) return `${startLabel} · All day`;

    return `${startLabel} – ${end.toLocaleDateString()} · All day`;
  }

  const startLabel = start.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (!end) return startLabel;

  return `${startLabel} – ${end.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

function formatAssignedCrew(schedule: JobSchedule) {
  if (schedule.crewMembers.length === 0) return "Unassigned";

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
