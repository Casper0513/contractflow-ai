"use client";

import Link from "next/link";
import { CalendarDays, Clock, MapPin, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobSchedule } from "@/lib/job-schedules-api";

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
  const open = Boolean(schedule) || Boolean(daySchedules);

  if (!open) {
    return null;
  }

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
                ? "Schedule event"
                : dayDate
                  ? dayDate.toLocaleDateString("en-CA", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Schedule"}
            </p>

            {!schedule && daySchedules && (
              <p className="mt-1 text-sm text-muted-foreground">
                {daySchedules.length} event
                {daySchedules.length === 1 ? "" : "s"}
              </p>
            )}
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
            <EventDetails schedule={schedule} />
          ) : (
            <DayDetails schedules={daySchedules ?? []} />
          )}
        </div>
      </div>
    </div>
  );
}

function EventDetails({ schedule }: { schedule: JobSchedule }) {
  const customerName = [schedule.job.customer.firstName, schedule.job.customer.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={schedule.type} />

          <StatusBadge status={schedule.status} />
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight">{schedule.title}</h2>

        {schedule.description && (
          <p className="mt-2 text-sm text-muted-foreground">{schedule.description}</p>
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

        {schedule.location && (
          <DetailRow icon={MapPin} label="Location" value={schedule.location} />
        )}
      </div>

      {schedule.notes && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-medium">Notes</p>

          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {schedule.notes}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
