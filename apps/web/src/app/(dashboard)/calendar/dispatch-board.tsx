"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  AlertTriangle,
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
import type { Job } from "@/lib/jobs-api";
import type { DispatchSettings } from "@/lib/organizations-api";

import { CalendarDetailsPanel } from "./calendar-details-panel";
import {
  DispatchBacklog,
  type DispatchBacklogDragPayload,
  type DispatchSuggestion,
} from "./dispatch-backlog";

type DispatchBoardProps = {
  view: "week" | "day";
  anchorDate: string;
  schedules: JobSchedule[];
  crewMembers: CrewMember[];
  backlogJobs: Job[];
  dispatchSettings: DispatchSettings;
};

type DispatchLane = {
  id: string;
  label: string;
  active: boolean;
  unassigned: boolean;
  dailyCapacityMinutes: number | null;
};

type ScheduleDragPayload = {
  kind: "schedule";
  scheduleId: string;
  jobId: string;
  sourceCrewMemberId: string | null;
  sourceDate: string;
};

type DragPayload = ScheduleDragPayload | DispatchBacklogDragPayload;

type DropPreview = {
  blocked: boolean;
  message: string | null;
};

type WorkloadSummary = {
  eventCount: number;
  timedMinutes: number;
  allDayCount: number;
};

const DRAG_TYPE = "application/x-contractflow-dispatch";

export function DispatchBoard({
  view,
  anchorDate,
  schedules,
  crewMembers,
  backlogJobs,
  dispatchSettings,
}: DispatchBoardProps) {
  const router = useRouter();
  const { getToken } = useAuth();

  const [selectedSchedule, setSelectedSchedule] = useState<JobSchedule | null>(null);

  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
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
        dailyCapacityMinutes: null,
      },
      ...visibleCrew.map((crewMember) => ({
        id: crewMember.id,
        label: crewMemberName(crewMember),
        active: crewMember.active,
        unassigned: false,
        dailyCapacityMinutes: crewMember.dailyCapacityMinutes,
      })),
    ];
  }, [crewMembers, schedules]);

  const dispatchSuggestions = useMemo<Record<string, DispatchSuggestion[]>>(
    () =>
      buildDispatchSuggestions({
        jobs: backlogJobs,
        dates,
        crewMembers,
        schedules,
        dispatchSettings,
      }),
    [backlogJobs, crewMembers, dates, dispatchSettings, schedules],
  );

  async function handleSuggestion(jobId: string, suggestion: DispatchSuggestion) {
    const lane = lanes.find((item) => item.id === suggestion.crewMemberId);

    if (!lane) {
      setDispatchError("The recommended crew member is no longer available.");
      return;
    }

    await scheduleBacklogJob(
      {
        kind: "backlog",
        jobId,
      },
      lane,
      parseLocalDate(suggestion.date),
    );
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    lane: DispatchLane,
    targetDate: Date,
  ) {
    event.preventDefault();

    const payload = dragging ?? readDragPayload(event);

    setDragOverCell(null);

    if (!payload || savingId) {
      return;
    }

    setDispatchError(null);

    if (payload.kind === "backlog") {
      await scheduleBacklogJob(payload, lane, targetDate);
      return;
    }

    await moveExistingSchedule(payload, lane, targetDate);
  }

  async function scheduleBacklogJob(
    payload: DispatchBacklogDragPayload,
    lane: DispatchLane,
    targetDate: Date,
  ) {
    const job = backlogJobs.find((item) => item.id === payload.jobId);

    if (!job) {
      setDispatchError("This backlog job is no longer available.");
      setDragging(null);
      return;
    }

    const targetCrewMemberId = lane.unassigned ? null : lane.id;
    const startAt = createBacklogScheduleStart(targetDate, dispatchSettings);

    setSavingId(job.id);

    try {
      const response = await authenticatedFetch(
        `/jobs/${job.id}/schedules/dispatch-backlog`,
        {
          method: "POST",
          body: JSON.stringify({
            startAt,
            crewMemberId: targetCrewMemberId,
          }),
        },
      );

      if (!response.ok) {
        setDispatchError(await readApiError(response));
        return;
      }

      setSelectedSchedule(null);
      router.refresh();
    } catch (error) {
      console.error("Backlog dispatch failed:", error);

      setDispatchError(
        error instanceof Error ? error.message : "Unable to schedule this backlog job.",
      );
    } finally {
      setSavingId(null);
      setDragging(null);
      setDragOverCell(null);
    }
  }

  async function moveExistingSchedule(
    payload: ScheduleDragPayload,
    lane: DispatchLane,
    targetDate: Date,
  ) {
    const schedule = schedules.find((item) => item.id === payload.scheduleId);

    if (!schedule) {
      setDispatchError("This schedule event is no longer available.");
      setDragging(null);
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

    setSavingId(schedule.id);

    try {
      const response = await authenticatedFetch(
        `/jobs/${schedule.jobId}/schedules/${schedule.id}/dispatch`,
        {
          method: "PATCH",
          body: JSON.stringify({
            startAt,
            endAt,
            sourceCrewMemberId: payload.sourceCrewMemberId,
            targetCrewMemberId,
          }),
        },
      );

      if (!response.ok) {
        setDispatchError(await readApiError(response));
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
      setSavingId(null);
      setDragging(null);
      setDragOverCell(null);
    }
  }

  async function authenticatedFetch(path: string, init: RequestInit) {
    const token = await getToken();

    if (!token) {
      throw new Error("Unable to authenticate this dispatch request.");
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!apiUrl) {
      throw new Error("NEXT_PUBLIC_API_URL is not configured.");
    }

    return fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...init.headers,
      },
    });
  }

  return (
    <>
      <div className="space-y-5">
        <DispatchBacklog
          jobs={backlogJobs}
          disabled={Boolean(savingId)}
          suggestions={dispatchSuggestions}
          onAcceptSuggestion={(jobId, suggestion) => {
            void handleSuggestion(jobId, suggestion);
          }}
          onDragStart={(payload) => {
            setDragging(payload);
            setDispatchError(null);
          }}
          onDragEnd={() => {
            setDragging(null);
            setDragOverCell(null);
          }}
        />

        <div className="space-y-3">
          <div className="flex flex-col gap-2 rounded-xl border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Drag-and-drop dispatch</p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Drag backlog jobs or scheduled events onto crew/date cells. Conflicts are
                blocked automatically.
              </p>
            </div>

            {savingId ? (
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
                  dispatchSettings={dispatchSettings}
                  dragging={dragging}
                  dragOverCell={dragOverCell}
                  savingId={savingId}
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
                  onBlockedDrop={(message) => {
                    setDispatchError(message);
                    setDragging(null);
                    setDragOverCell(null);
                  }}
                  onDrop={handleDrop}
                />
              ))}
            </div>
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
  dispatchSettings,
  dragging,
  dragOverCell,
  savingId,
  onEventClick,
  onDragStart,
  onDragEnd,
  onDragOverCell,
  onBlockedDrop,
  onDrop,
}: {
  lane: DispatchLane;
  dates: Date[];
  schedules: JobSchedule[];
  dispatchSettings: DispatchSettings;
  dragging: DragPayload | null;
  dragOverCell: string | null;
  savingId: string | null;
  onEventClick: (schedule: JobSchedule) => void;
  onDragStart: (payload: ScheduleDragPayload) => void;
  onDragEnd: () => void;
  onDragOverCell: (cellKey: string | null) => void;
  onBlockedDrop: (message: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, lane: DispatchLane, date: Date) => void;
}) {
  const laneWorkload = workloadForLaneDates(lane, dates, schedules);

  const dailyCapacityMinutes = lane.unassigned
    ? null
    : (lane.dailyCapacityMinutes ?? dispatchSettings.defaultCrewDailyCapacityMinutes);

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

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            {laneWorkload.eventCount} event
            {laneWorkload.eventCount === 1 ? "" : "s"}
          </span>

          {!lane.unassigned && laneWorkload.timedMinutes > 0 ? (
            <>
              <span>·</span>
              <span>{formatWorkloadMinutes(laneWorkload.timedMinutes)}</span>
            </>
          ) : null}

          {!lane.unassigned && laneWorkload.allDayCount > 0 ? (
            <>
              <span>·</span>
              <span>{laneWorkload.allDayCount} all-day</span>
            </>
          ) : null}

          {dailyCapacityMinutes ? (
            <>
              <span>·</span>
              <span>{formatWorkloadMinutes(dailyCapacityMinutes)} daily capacity</span>
            </>
          ) : null}
        </div>
      </div>

      {dates.map((date) => {
        const cellKey = buildCellKey(lane, date);
        const activeDrop = dragOverCell === cellKey;

        const laneSchedules = schedulesForLaneDate(lane, date, schedules);

        const workload = summarizeSchedulesForDate(laneSchedules, date);

        const eligibleForDrag =
          dragging !== null && !savingId && (lane.unassigned || lane.active);

        const preview =
          eligibleForDrag && dragging
            ? getDropPreview({
                payload: dragging,
                lane,
                targetDate: date,
                schedules,
                dispatchSettings,
              })
            : null;

        const blocked = Boolean(preview?.blocked);
        const canDrop = eligibleForDrag && !blocked;

        const capacityMinutes = lane.unassigned
          ? null
          : (lane.dailyCapacityMinutes ??
            dispatchSettings.defaultCrewDailyCapacityMinutes);

        const overloaded =
          capacityMinutes !== null && workload.timedMinutes > capacityMinutes;

        const busy =
          capacityMinutes !== null &&
          !overloaded &&
          (workload.timedMinutes >= capacityMinutes || workload.allDayCount > 0);

        return (
          <div
            key={cellKey}
            onDragEnter={(event) => {
              if (!eligibleForDrag) {
                return;
              }

              event.preventDefault();
              onDragOverCell(cellKey);
            }}
            onDragOver={(event) => {
              if (!eligibleForDrag) {
                return;
              }

              event.preventDefault();
              event.dataTransfer.dropEffect = blocked ? "none" : "move";

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
              if (!eligibleForDrag) {
                return;
              }

              event.preventDefault();

              if (blocked) {
                onBlockedDrop(
                  preview?.message ?? "This crew member has a scheduling conflict.",
                );
                return;
              }

              if (canDrop) {
                void onDrop(event, lane, date);
              }
            }}
            className={`min-h-32 border-b border-r p-2 transition-colors last:border-r-0 ${
              activeDrop && blocked
                ? "bg-destructive/10 ring-2 ring-inset ring-destructive/40"
                : activeDrop
                  ? "bg-primary/10 ring-2 ring-inset ring-primary/40"
                  : dragging && eligibleForDrag
                    ? blocked
                      ? "bg-destructive/5"
                      : "bg-muted/10"
                    : overloaded
                      ? "bg-amber-500/5"
                      : ""
            }`}
          >
            {!lane.unassigned && (workload.eventCount > 0 || workload.allDayCount > 0) ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    overloaded
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
                      : busy
                        ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                        : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  {workload.timedMinutes > 0
                    ? formatWorkloadMinutes(workload.timedMinutes)
                    : `${workload.eventCount} event${
                        workload.eventCount === 1 ? "" : "s"
                      }`}
                </span>

                {workload.allDayCount > 0 ? (
                  <span className="rounded-full border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {workload.allDayCount} all-day
                  </span>
                ) : null}

                {overloaded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Over {formatWorkloadMinutes(capacityMinutes ?? 0)}
                  </span>
                ) : busy ? (
                  <span className="text-[10px] font-medium text-blue-700">Busy</span>
                ) : null}
              </div>
            ) : null}

            {activeDrop && blocked ? (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-background/80 p-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                <div>
                  <p className="font-medium">Blocked</p>
                  <p className="mt-0.5 line-clamp-3">{preview?.message}</p>
                </div>
              </div>
            ) : null}

            {laneSchedules.length === 0 ? (
              <div
                className={`flex min-h-24 items-center justify-center rounded-lg border border-dashed text-xs transition-colors ${
                  activeDrop && blocked
                    ? "border-destructive/50 text-destructive"
                    : activeDrop
                      ? "border-primary/60 text-primary"
                      : "text-muted-foreground/60"
                }`}
              >
                {activeDrop ? (blocked ? "Conflict" : "Drop here") : "—"}
              </div>
            ) : (
              <div className="space-y-2">
                {laneSchedules.map((schedule) => (
                  <DispatchEvent
                    key={`${schedule.id}-${lane.id}`}
                    schedule={schedule}
                    sourceCrewMemberId={lane.unassigned ? null : lane.id}
                    disabled={Boolean(savingId)}
                    saving={savingId === schedule.id}
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
  onDragStart: (payload: ScheduleDragPayload) => void;
  onDragEnd: () => void;
}) {
  const draggable = !disabled && schedule.status !== "CANCELLED";

  function startDrag(event: DragEvent<HTMLButtonElement>) {
    if (!draggable) {
      event.preventDefault();
      return;
    }

    const payload: ScheduleDragPayload = {
      kind: "schedule",
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
  return schedules
    .filter((schedule) => scheduleOverlapsLocalDate(schedule, date))
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

function workloadForLaneDates(
  lane: DispatchLane,
  dates: Date[],
  schedules: JobSchedule[],
) {
  return dates.reduce<WorkloadSummary>(
    (summary, date) => {
      const laneSchedules = schedulesForLaneDate(lane, date, schedules);
      const daily = summarizeSchedulesForDate(laneSchedules, date);

      summary.eventCount += daily.eventCount;
      summary.timedMinutes += daily.timedMinutes;
      summary.allDayCount += daily.allDayCount;

      return summary;
    },
    {
      eventCount: 0,
      timedMinutes: 0,
      allDayCount: 0,
    },
  );
}

function summarizeSchedulesForDate(
  schedules: JobSchedule[],
  date: Date,
): WorkloadSummary {
  const dayStart = startOfLocalDay(date).getTime();
  const nextDayStart = addLocalDays(startOfLocalDay(date), 1).getTime();

  return schedules.reduce<WorkloadSummary>(
    (summary, schedule) => {
      if (schedule.status === "CANCELLED") {
        return summary;
      }

      summary.eventCount += 1;

      if (schedule.allDay) {
        summary.allDayCount += 1;
        return summary;
      }

      if (!schedule.endAt) {
        return summary;
      }

      const start = new Date(schedule.startAt).getTime();
      const end = new Date(schedule.endAt).getTime();

      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
        return summary;
      }

      const visibleStart = Math.max(start, dayStart);
      const visibleEnd = Math.min(end, nextDayStart);

      if (visibleEnd <= visibleStart) {
        return summary;
      }

      summary.timedMinutes += Math.round((visibleEnd - visibleStart) / 60_000);

      return summary;
    },
    {
      eventCount: 0,
      timedMinutes: 0,
      allDayCount: 0,
    },
  );
}

function scheduleOverlapsLocalDate(schedule: JobSchedule, date: Date) {
  const start = new Date(schedule.startAt).getTime();

  if (Number.isNaN(start)) {
    return false;
  }

  const dayStart = startOfLocalDay(date).getTime();
  const nextDayStart = addLocalDays(startOfLocalDay(date), 1).getTime();

  if (!schedule.endAt) {
    return start >= dayStart && start < nextDayStart;
  }

  const end = new Date(schedule.endAt).getTime();

  if (Number.isNaN(end) || end <= start) {
    return start >= dayStart && start < nextDayStart;
  }

  return start < nextDayStart && end > dayStart;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function addLocalDays(date: Date, days: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
}

function buildDispatchSuggestions({
  jobs,
  dates,
  crewMembers,
  schedules,
  dispatchSettings,
}: {
  jobs: Job[];
  dates: Date[];
  crewMembers: CrewMember[];
  schedules: JobSchedule[];
  dispatchSettings: DispatchSettings;
}) {
  return jobs.reduce<Record<string, DispatchSuggestion[]>>((suggestions, job) => {
    const ranked = findRankedDispatchSuggestions({
      job,
      dates,
      crewMembers,
      schedules,
      dispatchSettings,
    });

    if (ranked.length > 0) {
      suggestions[job.id] = ranked;
    }

    return suggestions;
  }, {});
}

function findRankedDispatchSuggestions({
  job,
  dates,
  crewMembers,
  schedules,
  dispatchSettings,
}: {
  job: Job;
  dates: Date[];
  crewMembers: CrewMember[];
  schedules: JobSchedule[];
  dispatchSettings: DispatchSettings;
}): DispatchSuggestion[] {
  const activeCrew = crewMembers.filter((crewMember) => crewMember.active);

  const operationalDates = dates.filter(isOperationalDay);

  if (activeCrew.length === 0 || operationalDates.length === 0) {
    return [];
  }

  const requestedStart = job.startDate ? new Date(job.startDate) : null;

  const requestedDay =
    requestedStart && !Number.isNaN(requestedStart.getTime())
      ? startOfLocalDay(requestedStart)
      : null;

  const candidates: Array<
    Omit<DispatchSuggestion, "rank" | "reason"> & {
      score: number;
      matchesRequestedDate: boolean;
      projectedOverCapacity: boolean;
    }
  > = [];

  for (const date of operationalDates) {
    for (const crewMember of activeCrew) {
      const lane: DispatchLane = {
        id: crewMember.id,
        label: crewMemberName(crewMember),
        active: true,
        unassigned: false,
        dailyCapacityMinutes: crewMember.dailyCapacityMinutes,
      };

      const preview = getDropPreview({
        payload: {
          kind: "backlog",
          jobId: job.id,
        },
        lane,
        targetDate: date,
        schedules,
        dispatchSettings,
      });

      if (preview.blocked) {
        continue;
      }

      const capacityMinutes =
        crewMember.dailyCapacityMinutes ??
        dispatchSettings.defaultCrewDailyCapacityMinutes;

      const laneSchedules = schedulesForLaneDate(lane, date, schedules);

      const workload = summarizeSchedulesForDate(laneSchedules, date);

      const currentMinutes =
        workload.allDayCount > 0
          ? Math.max(capacityMinutes, workload.timedMinutes)
          : workload.timedMinutes;

      const projectedMinutes = currentMinutes + dispatchSettings.defaultDurationMinutes;

      const utilizationPercent =
        capacityMinutes > 0
          ? Math.round((projectedMinutes / capacityMinutes) * 100)
          : 100;

      const remainingMinutes = Math.max(capacityMinutes - projectedMinutes, 0);

      const datePenalty = requestedDay
        ? requestedDatePenalty(date, requestedDay)
        : calendarDayNumber(date) - calendarDayNumber(operationalDates[0]);

      const overloadPenalty =
        projectedMinutes > capacityMinutes
          ? 10_000 + (projectedMinutes - capacityMinutes) * 10
          : 0;

      candidates.push({
        crewMemberId: crewMember.id,
        crewMemberName: crewMemberName(crewMember),
        date: dateKey(date),
        utilizationPercent,
        remainingMinutes,

        score: overloadPenalty + datePenalty * 100 + utilizationPercent,

        matchesRequestedDate:
          requestedDay !== null && dateKey(date) === dateKey(requestedDay),

        projectedOverCapacity: projectedMinutes > capacityMinutes,
      });
    }
  }

  const ranked = candidates
    .sort(
      (first, second) =>
        first.score - second.score ||
        first.utilizationPercent - second.utilizationPercent ||
        first.date.localeCompare(second.date) ||
        first.crewMemberName.localeCompare(second.crewMemberName),
    )
    .slice(0, 3);

  return ranked.map((candidate, index) => ({
    rank: index + 1,

    crewMemberId: candidate.crewMemberId,
    crewMemberName: candidate.crewMemberName,

    date: candidate.date,

    utilizationPercent: candidate.utilizationPercent,

    remainingMinutes: candidate.remainingMinutes,

    reason: dispatchSuggestionReason({
      matchesRequestedDate: candidate.matchesRequestedDate,

      projectedOverCapacity: candidate.projectedOverCapacity,

      utilizationPercent: candidate.utilizationPercent,

      rank: index + 1,
    }),
  }));
}

function dispatchSuggestionReason({
  matchesRequestedDate,
  projectedOverCapacity,
  utilizationPercent,
  rank,
}: {
  matchesRequestedDate: boolean;
  projectedOverCapacity: boolean;
  utilizationPercent: number;
  rank: number;
}) {
  if (projectedOverCapacity) {
    return `Conflict-free, but projected above capacity at ${utilizationPercent}%.`;
  }

  if (matchesRequestedDate && rank === 1) {
    return "Matches the requested start date with the strongest capacity fit.";
  }

  if (matchesRequestedDate) {
    return "Matches the requested start date with available crew capacity.";
  }

  if (rank === 1) {
    return "Best conflict-free balance of requested timing and crew utilization.";
  }

  return "Conflict-free alternative with available crew capacity.";
}

function requestedDatePenalty(date: Date, requestedDay: Date) {
  const difference = calendarDayNumber(date) - calendarDayNumber(requestedDay);

  if (difference < 0) {
    return 100 + Math.abs(difference);
  }

  return difference;
}

function isOperationalDay(date: Date) {
  const day = date.getDay();

  return day >= 1 && day <= 5;
}

function getDropPreview({
  payload,
  lane,
  targetDate,
  schedules,
  dispatchSettings,
}: {
  payload: DragPayload;
  lane: DispatchLane;
  targetDate: Date;
  schedules: JobSchedule[];
  dispatchSettings: DispatchSettings;
}): DropPreview {
  if (lane.unassigned && payload.kind === "backlog") {
    return {
      blocked: false,
      message: null,
    };
  }

  if (payload.kind === "backlog") {
    const startAt = new Date(createBacklogScheduleStart(targetDate, dispatchSettings));

    const endAt = new Date(
      startAt.getTime() + dispatchSettings.defaultDurationMinutes * 60_000,
    );

    if (lane.unassigned) {
      return {
        blocked: false,
        message: null,
      };
    }

    return conflictPreviewForCrewMembers({
      crewMemberIds: [lane.id],
      startAt,
      endAt,
      schedules,
      excludedScheduleId: null,
    });
  }

  const schedule = schedules.find((item) => item.id === payload.scheduleId);

  if (!schedule) {
    return {
      blocked: true,
      message: "This schedule event is no longer available.",
    };
  }

  const { startAt, endAt } = moveScheduleToDate(schedule, targetDate);

  const resultingCrewMemberIds = new Set(
    schedule.crewMembers.map((assignment) => assignment.crewMember.id),
  );

  const targetCrewMemberId = lane.unassigned ? null : lane.id;

  if (payload.sourceCrewMemberId && payload.sourceCrewMemberId !== targetCrewMemberId) {
    resultingCrewMemberIds.delete(payload.sourceCrewMemberId);
  }

  if (targetCrewMemberId) {
    resultingCrewMemberIds.add(targetCrewMemberId);
  }

  return conflictPreviewForCrewMembers({
    crewMemberIds: [...resultingCrewMemberIds],
    startAt: new Date(startAt),
    endAt: endAt ? new Date(endAt) : null,
    schedules,
    excludedScheduleId: schedule.id,
  });
}

function conflictPreviewForCrewMembers({
  crewMemberIds,
  startAt,
  endAt,
  schedules,
  excludedScheduleId,
}: {
  crewMemberIds: string[];
  startAt: Date;
  endAt: Date | null;
  schedules: JobSchedule[];
  excludedScheduleId: string | null;
}): DropPreview {
  for (const crewMemberId of crewMemberIds) {
    const conflict = schedules
      .filter(
        (schedule) =>
          schedule.id !== excludedScheduleId &&
          schedule.status !== "CANCELLED" &&
          schedule.crewMembers.some(
            (assignment) => assignment.crewMember.id === crewMemberId,
          ),
      )
      .filter((schedule) =>
        schedulesOverlap(
          startAt,
          endAt,
          new Date(schedule.startAt),
          schedule.endAt ? new Date(schedule.endAt) : null,
        ),
      )
      .sort(
        (first, second) =>
          new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
      )[0];

    if (!conflict) {
      continue;
    }

    const crewMember = conflict.crewMembers.find(
      (assignment) => assignment.crewMember.id === crewMemberId,
    )?.crewMember;

    const crewName = crewMember ? crewMemberName(crewMember) : "Crew member";

    return {
      blocked: true,
      message: `${crewName} already has "${conflict.title}" (${formatScheduleTime(
        conflict,
      )}) for ${conflict.job.name}.`,
    };
  }

  return {
    blocked: false,
    message: null,
  };
}

function schedulesOverlap(
  candidateStart: Date,
  candidateEnd: Date | null,
  existingStart: Date,
  existingEnd: Date | null,
) {
  if (!candidateEnd) {
    if (existingEnd === null && existingStart.getTime() === candidateStart.getTime()) {
      return true;
    }

    return (
      existingStart.getTime() <= candidateStart.getTime() &&
      existingEnd !== null &&
      existingEnd.getTime() > candidateStart.getTime()
    );
  }

  if (existingEnd === null) {
    return (
      existingStart.getTime() >= candidateStart.getTime() &&
      existingStart.getTime() < candidateEnd.getTime()
    );
  }

  return (
    existingStart.getTime() < candidateEnd.getTime() &&
    existingEnd.getTime() > candidateStart.getTime()
  );
}

function formatWorkloadMinutes(minutes: number) {
  const hours = minutes / 60;

  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
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

function createBacklogScheduleStart(targetDate: Date, settings: DispatchSettings) {
  const start = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    settings.defaultStartHour,
    settings.defaultStartMinute,
    0,
    0,
  );

  return start.toISOString();
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

    const parsed = JSON.parse(value) as
      Partial<ScheduleDragPayload> | Partial<DispatchBacklogDragPayload>;

    if (parsed.kind === "backlog") {
      if (typeof parsed.jobId !== "string") {
        return null;
      }

      return {
        kind: "backlog",
        jobId: parsed.jobId,
      };
    }

    if (parsed.kind !== "schedule") {
      return null;
    }

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
      kind: "schedule",
      scheduleId: parsed.scheduleId,
      jobId: parsed.jobId,
      sourceDate: parsed.sourceDate,
      sourceCrewMemberId: parsed.sourceCrewMemberId ?? null,
    };
  } catch {
    return null;
  }
}

async function readApiError(response: Response) {
  const data = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;

  if (Array.isArray(data?.message)) {
    return data.message.join(", ");
  }

  return data?.message ?? "Unable to complete this dispatch action.";
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
