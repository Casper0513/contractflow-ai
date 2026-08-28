"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  CalendarDays,
  Clock,
  GripVertical,
  LoaderCircle,
  MapPin,
  UserRound,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";

import type { CrewMember } from "@/lib/crew-api";
import type { JobSchedule } from "@/lib/job-schedules-api";

import { CalendarDetailsPanel } from "./calendar-details-panel";

type DispatchBoardProps = {
  view: "week" | "day";
  anchorDate: string;
  schedules: JobSchedule[];
  crewMembers: CrewMember[];
};

type DispatchLane = {
  id: string;
  label: string;
  active: boolean;
  unassigned: boolean;
};

type DragPayload = {
  scheduleId: string;
  jobId: string;
  sourceCrewMemberId: string | null;
  sourceDate: string;
};

const DRAG_TYPE = "application/x-contractflow-dispatch";

export function DispatchBoard({
  view,
  anchorDate,
  schedules,
  crewMembers,
}: DispatchBoardProps) {
  const router = useRouter();

  const { getToken } = useAuth();

  const [selectedSchedule, setSelectedSchedule] = useState<JobSchedule | null>(null);

  const [dragging, setDragging] = useState<DragPayload | null>(null);

  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const [dispatchingScheduleId, setDispatchingScheduleId] = useState<string | null>(null);

  const [dispatchError, setDispatchError] = useState<string | null>(null);

  const dates = useMemo(() => {
    const anchor = parseLocalDate(anchorDate);

    return view === "day" ? [anchor] : buildWeekDates(anchor);
  }, [anchorDate, view]);

  const lanes = useMemo<DispatchLane[]>(() => {
    const assignedCrewIds = new Set(
      schedules.flatMap((schedule) =>
        schedule.crewMembers.map((assignment) => assignment.crewMember.id),
      ),
    );

    const visibleCrew = crewMembers.filter(
      (crewMember) => crewMember.active || assignedCrewIds.has(crewMember.id),
    );

    return [
      {
        id: "unassigned",
        label: "Unassigned",
        active: true,
        unassigned: true,
      },

      ...visibleCrew.map((crewMember) => ({
        id: crewMember.id,
        label: crewMemberName(crewMember),
        active: crewMember.active,
        unassigned: false,
      })),
    ];
  }, [crewMembers, schedules]);

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    lane: DispatchLane,
    targetDate: Date,
  ) {
    event.preventDefault();

    const payload = dragging ?? readDragPayload(event);

    setDragOverCell(null);

    if (!payload || dispatchingScheduleId) {
      return;
    }

    const schedule = schedules.find((item) => item.id === payload.scheduleId);

    if (!schedule) {
      setDispatchError("This schedule event is no longer available.");

      return;
    }

    const targetCrewMemberId = lane.unassigned ? null : lane.id;

    const targetDateKey = dateKey(targetDate);

    const sameCrew = payload.sourceCrewMemberId === targetCrewMemberId;

    const sameDate = payload.sourceDate === targetDateKey;

    if (sameCrew && sameDate) {
      setDragging(null);
      return;
    }

    const { startAt, endAt } = moveScheduleToDate(schedule, targetDate);

    setDispatchingScheduleId(schedule.id);
    setDispatchError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to authenticate this dispatch request.");
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        throw new Error("NEXT_PUBLIC_API_URL is not configured.");
      }

      const response = await fetch(
        `${apiUrl}/jobs/${schedule.jobId}/schedules/${schedule.id}/dispatch`,
        {
          method: "PATCH",

          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            startAt,
            endAt,

            sourceCrewMemberId: payload.sourceCrewMemberId,

            targetCrewMemberId,
          }),
        },
      );

      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!response.ok) {
        setDispatchError(data?.message ?? "Unable to move this schedule event.");

        return;
      }

      setSelectedSchedule(null);

      router.refresh();
    } catch (error) {
      console.error("Dispatch move failed:", error);

      setDispatchError(
        error instanceof Error ? error.message : "Unable to move this schedule event.",
      );
    } finally {
      setDispatchingScheduleId(null);
      setDragging(null);
      setDragOverCell(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Drag-and-drop dispatch</p>

            <p className="mt-0.5 text-xs text-muted-foreground">
              Drag an event between crew lanes or days. Scheduling conflicts are blocked
              automatically.
            </p>
          </div>

          {dispatchingScheduleId ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Saving dispatch...
            </div>
          ) : null}
        </div>

        {dispatchError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <p className="font-medium">Dispatch conflict</p>

            <p className="mt-1">{dispatchError}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border bg-background">
          <div
            className="grid min-w-[900px]"
            style={{
              gridTemplateColumns:
                view === "day"
                  ? "220px minmax(620px, 1fr)"
                  : `220px repeat(${dates.length}, minmax(180px, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-20 border-b border-r bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />

                <span className="text-sm font-semibold">Crew</span>
              </div>
            </div>

            {dates.map((date) => (
              <DispatchDateHeader key={dateKey(date)} date={date} />
            ))}

            {lanes.map((lane) => (
              <DispatchLaneRow
                key={lane.id}
                lane={lane}
                dates={dates}
                schedules={schedules}
                dragging={dragging}
                dragOverCell={dragOverCell}
                dispatchingScheduleId={dispatchingScheduleId}
                onEventClick={setSelectedSchedule}
                onDragStart={(payload) => {
                  setDragging(payload);
                  setDispatchError(null);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDragOverCell(null);
                }}
                onDragOverCell={setDragOverCell}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      </div>

      <CalendarDetailsPanel
        schedule={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
      />
    </>
  );
}

function DispatchDateHeader({ date }: { date: Date }) {
  const today = isToday(date);

  return (
    <div
      className={`border-b border-r p-3 last:border-r-0 ${
        today ? "bg-primary/5" : "bg-muted/20"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {date.toLocaleDateString("en-CA", {
          weekday: "short",
        })}
      </p>

      <div className="mt-1 flex items-center gap-2">
        <span
          className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold ${
            today ? "bg-primary text-primary-foreground" : ""
          }`}
        >
          {date.getDate()}
        </span>

        <span className="text-sm">
          {date.toLocaleDateString("en-CA", {
            month: "short",
          })}
        </span>
      </div>
    </div>
  );
}

function DispatchLaneRow({
  lane,
  dates,
  schedules,
  dragging,
  dragOverCell,
  dispatchingScheduleId,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onDrop,
}: {
  lane: DispatchLane;
  dates: Date[];
  schedules: JobSchedule[];

  dragging: DragPayload | null;
  dragOverCell: string | null;
  dispatchingScheduleId: string | null;

  onEventClick: (schedule: JobSchedule) => void;

  onDragStart: (payload: DragPayload) => void;

  onDragEnd: () => void;

  onDragOverCell: (cellKey: string | null) => void;

  onDrop: (event: DragEvent<HTMLDivElement>, lane: DispatchLane, date: Date) => void;
}) {
  const laneCount = countLaneSchedules(lane, schedules);

  return (
    <>
      <div className="sticky left-0 z-10 border-b border-r bg-background p-3">
        <div className="flex items-center gap-2">
          {lane.unassigned ? (
            <Users className="h-4 w-4 text-amber-600" />
          ) : (
            <UserRound className="h-4 w-4 text-muted-foreground" />
          )}

          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{lane.label}</p>

            {!lane.active && !lane.unassigned ? (
              <p className="text-xs text-muted-foreground">Inactive</p>
            ) : null}
          </div>
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {laneCount} event
          {laneCount === 1 ? "" : "s"}
        </p>
      </div>

      {dates.map((date) => {
        const cellKey = buildCellKey(lane, date);

        const activeDrop = dragOverCell === cellKey;

        const laneSchedules = schedulesForLaneDate(lane, date, schedules);

        const canDrop =
          dragging !== null && !dispatchingScheduleId && (lane.unassigned || lane.active);

        return (
          <div
            key={cellKey}
            onDragEnter={(event) => {
              if (!canDrop) {
                return;
              }

              event.preventDefault();

              onDragOverCell(cellKey);
            }}
            onDragOver={(event) => {
              if (!canDrop) {
                return;
              }

              event.preventDefault();

              event.dataTransfer.dropEffect = "move";

              if (dragOverCell !== cellKey) {
                onDragOverCell(cellKey);
              }
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) {
                return;
              }

              if (dragOverCell === cellKey) {
                onDragOverCell(null);
              }
            }}
            onDrop={(event) => {
              if (!canDrop) {
                return;
              }

              void onDrop(event, lane, date);
            }}
            className={`min-h-32 border-b border-r p-2 transition-colors last:border-r-0 ${
              activeDrop
                ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
                : dragging && canDrop
                  ? "bg-muted/10"
                  : ""
            }`}
          >
            {laneSchedules.length === 0 ? (
              <div
                className={`flex min-h-24 items-center justify-center rounded-lg border border-dashed text-xs transition-colors ${
                  activeDrop
                    ? "border-primary/60 text-primary"
                    : "text-muted-foreground/60"
                }`}
              >
                {activeDrop ? "Drop here" : "—"}
              </div>
            ) : (
              <div className="space-y-2">
                {laneSchedules.map((schedule) => (
                  <DispatchEvent
                    key={`${schedule.id}-${lane.id}`}
                    schedule={schedule}
                    sourceCrewMemberId={lane.unassigned ? null : lane.id}
                    disabled={Boolean(dispatchingScheduleId)}
                    saving={dispatchingScheduleId === schedule.id}
                    onClick={onEventClick}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function DispatchEvent({
  schedule,
  sourceCrewMemberId,
  disabled,
  saving,
  onClick,
  onDragStart,
  onDragEnd,
}: {
  schedule: JobSchedule;

  sourceCrewMemberId: string | null;

  disabled: boolean;
  saving: boolean;

  onClick: (schedule: JobSchedule) => void;

  onDragStart: (payload: DragPayload) => void;

  onDragEnd: () => void;
}) {
  const draggable = !disabled && schedule.status !== "CANCELLED";

  function startDrag(event: DragEvent<HTMLButtonElement>) {
    if (!draggable) {
      event.preventDefault();
      return;
    }

    const payload: DragPayload = {
      scheduleId: schedule.id,

      jobId: schedule.jobId,

      sourceCrewMemberId,

      sourceDate: dateKey(new Date(schedule.startAt)),
    };

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));

    event.dataTransfer.setData("text/plain", schedule.title);

    onDragStart(payload);
  }

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={startDrag}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (!saving) {
          onClick(schedule);
        }
      }}
      className={`group block w-full rounded-lg border bg-background p-2.5 text-left shadow-sm transition-all ${
        draggable
          ? "cursor-grab hover:bg-muted/40 active:cursor-grabbing"
          : "cursor-default"
      } ${saving ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className={`mt-0.5 h-4 w-4 shrink-0 ${
            draggable
              ? "text-muted-foreground opacity-50 transition-opacity group-hover:opacity-100"
              : "text-muted-foreground/30"
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium">{schedule.title}</p>

            {saving ? (
              <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <ScheduleTypeDot type={schedule.type} />
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {schedule.allDay ? (
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 shrink-0" />
            )}

            <span className="truncate">{formatScheduleTime(schedule)}</span>
          </div>

          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            {schedule.job.name}
          </p>

          {schedule.location ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />

              <span className="truncate">{schedule.location}</span>
            </div>
          ) : null}

          {schedule.status === "CANCELLED" ? (
            <span className="mt-2 inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-600">
              Cancelled
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function schedulesForLaneDate(lane: DispatchLane, date: Date, schedules: JobSchedule[]) {
  const key = dateKey(date);

  return schedules
    .filter((schedule) => dateKey(new Date(schedule.startAt)) === key)
    .filter((schedule) => {
      if (lane.unassigned) {
        return schedule.crewMembers.length === 0;
      }

      return schedule.crewMembers.some(
        (assignment) => assignment.crewMember.id === lane.id,
      );
    })
    .sort(
      (first, second) =>
        new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
    );
}

function countLaneSchedules(lane: DispatchLane, schedules: JobSchedule[]) {
  if (lane.unassigned) {
    return schedules.filter((schedule) => schedule.crewMembers.length === 0).length;
  }

  return schedules.filter((schedule) =>
    schedule.crewMembers.some((assignment) => assignment.crewMember.id === lane.id),
  ).length;
}

function moveScheduleToDate(schedule: JobSchedule, targetDate: Date) {
  const oldStart = new Date(schedule.startAt);

  const oldEnd = schedule.endAt ? new Date(schedule.endAt) : null;

  const dayDelta = calendarDayNumber(targetDate) - calendarDayNumber(oldStart);

  const newStart = new Date(oldStart);

  newStart.setDate(newStart.getDate() + dayDelta);

  const newEnd = oldEnd ? new Date(oldEnd) : null;

  if (newEnd) {
    newEnd.setDate(newEnd.getDate() + dayDelta);
  }

  return {
    startAt: newStart.toISOString(),

    endAt: newEnd?.toISOString() ?? null,
  };
}

function calendarDayNumber(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

function readDragPayload(event: DragEvent<HTMLDivElement>): DragPayload | null {
  try {
    const value = event.dataTransfer.getData(DRAG_TYPE);

    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value) as Partial<DragPayload>;

    if (
      typeof parsed.scheduleId !== "string" ||
      typeof parsed.jobId !== "string" ||
      typeof parsed.sourceDate !== "string"
    ) {
      return null;
    }

    if (
      parsed.sourceCrewMemberId !== null &&
      parsed.sourceCrewMemberId !== undefined &&
      typeof parsed.sourceCrewMemberId !== "string"
    ) {
      return null;
    }

    return {
      scheduleId: parsed.scheduleId,

      jobId: parsed.jobId,

      sourceDate: parsed.sourceDate,

      sourceCrewMemberId: parsed.sourceCrewMemberId ?? null,
    };
  } catch {
    return null;
  }
}

function buildCellKey(lane: DispatchLane, date: Date) {
  return `${lane.id}:${dateKey(date)}`;
}

function buildWeekDates(anchor: Date) {
  const mondayOffset = (anchor.getDay() + 6) % 7;

  const monday = new Date(anchor);

  monday.setDate(anchor.getDate() - mondayOffset);

  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);

    date.setDate(monday.getDate() + index);

    return date;
  });
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function crewMemberName(crewMember: { firstName: string; lastName: string | null }) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(" ");
}

function formatScheduleTime(schedule: JobSchedule) {
  if (schedule.allDay) {
    return "All day";
  }

  const start = new Date(schedule.startAt);

  const startLabel = start.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (!schedule.endAt) {
    return startLabel;
  }

  const end = new Date(schedule.endAt);

  return `${startLabel} – ${end.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function ScheduleTypeDot({ type }: { type: JobSchedule["type"] }) {
  return (
    <span
      title={formatEnumLabel(type)}
      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${typeStyles[type]}`}
    />
  );
}

const typeStyles: Record<JobSchedule["type"], string> = {
  WORK: "bg-blue-500",
  SITE_VISIT: "bg-violet-500",
  ESTIMATE: "bg-indigo-500",
  INSPECTION: "bg-amber-500",
  DELIVERY: "bg-orange-500",
  MEETING: "bg-cyan-500",
  OTHER: "bg-muted-foreground",
};

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isToday(date: Date) {
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
