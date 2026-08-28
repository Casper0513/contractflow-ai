"use client";

import {
  AlertTriangle,
  CalendarClock,
  CircleGauge,
  Clock3,
  Gauge,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CrewMember } from "@/lib/crew-api";
import type { JobSchedule } from "@/lib/job-schedules-api";
import type { Job } from "@/lib/jobs-api";
import type { DispatchSettings } from "@/lib/organizations-api";

type DispatchRiskDashboardProps = {
  schedules: JobSchedule[];
  crewMembers: CrewMember[];
  backlogJobs: Job[];
  dispatchSettings: DispatchSettings;
  rangeStart: string;
  rangeEnd: string;
  view: "month" | "week" | "day";
  anchorDate: string;
};

type CrewUtilization = {
  crewMemberId: string;
  name: string;
  scheduledMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  overloadedDays: number;
  openCapacityDays: number;
};

type CrewDayUtilization = {
  crewMemberId: string;
  crewName: string;
  date: Date;
  scheduledMinutes: number;
  capacityMinutes: number;
  utilizationPercent: number;
  operationalDay: boolean;
};

const BACKLOG_AGING_DAYS = 7;
const OPEN_CAPACITY_THRESHOLD = 50;

export function DispatchRiskDashboard({
  schedules,
  crewMembers,
  backlogJobs,
  dispatchSettings,
  rangeStart,
  rangeEnd,
  view,
  anchorDate,
}: DispatchRiskDashboardProps) {
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);
  const dates = buildLocalDates(start, end);

  const activeCrew = crewMembers.filter((crewMember) => crewMember.active);
  const activeSchedules = schedules.filter((schedule) => schedule.status !== "CANCELLED");

  const crewDayUtilization = activeCrew.flatMap((crewMember) =>
    dates.map((date) =>
      calculateCrewDayUtilization(
        crewMember,
        date,
        activeSchedules,
        dispatchSettings.defaultCrewDailyCapacityMinutes,
      ),
    ),
  );

  const crewUtilization = activeCrew.map((crewMember) =>
    calculateCrewUtilization(crewMember, crewDayUtilization),
  );

  const totalScheduledMinutes = crewDayUtilization.reduce(
    (total, day) => total + day.scheduledMinutes,
    0,
  );

  const totalCapacityMinutes = crewDayUtilization.reduce(
    (total, day) => total + day.capacityMinutes,
    0,
  );

  const averageUtilization =
    totalCapacityMinutes > 0
      ? Math.round((totalScheduledMinutes / totalCapacityMinutes) * 100)
      : 0;

  const overloadedDays = crewDayUtilization.filter((day) => day.utilizationPercent > 100);

  const openCapacityDays = crewDayUtilization.filter(
    (day) => day.operationalDay && day.utilizationPercent < OPEN_CAPACITY_THRESHOLD,
  );

  const unassignedSchedules = activeSchedules.filter(
    (schedule) => schedule.crewMembers.length === 0,
  );

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const agingCutoff = new Date(now.getTime() - BACKLOG_AGING_DAYS * 24 * 60 * 60 * 1000);

  const lateBacklog = backlogJobs.filter((job) => {
    if (!job.startDate) return false;

    const startDate = new Date(job.startDate);

    return (
      !Number.isNaN(startDate.getTime()) && startDate.getTime() < todayStart.getTime()
    );
  });

  const agingBacklog = backlogJobs.filter((job) => {
    const createdAt = new Date(job.createdAt);

    return (
      !Number.isNaN(createdAt.getTime()) && createdAt.getTime() < agingCutoff.getTime()
    );
  });

  const priorityBacklog = backlogJobs.filter(
    (job) => job.priority === "HIGH" || job.priority === "URGENT",
  );

  const attentionCount =
    overloadedDays.length +
    lateBacklog.length +
    agingBacklog.length +
    priorityBacklog.length +
    unassignedSchedules.length;

  const firstOverloadedDay = overloadedDays[0] ?? null;

  const bestOpenCapacityDay =
    [...openCapacityDays].sort(
      (first, second) =>
        first.utilizationPercent - second.utilizationPercent ||
        first.date.getTime() - second.date.getTime(),
    )[0] ?? null;

  const firstAttentionJob =
    lateBacklog[0] ?? agingBacklog[0] ?? priorityBacklog[0] ?? null;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2">
              <CircleGauge className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Dispatch risk & utilization</h2>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Crew capacity, open availability, and jobs that may need dispatcher
              attention.
            </p>
          </div>

          <div className="rounded-full border bg-muted/20 px-3 py-1 text-sm">
            {attentionCount === 0
              ? "No active dispatch risks"
              : `${attentionCount} attention signal${attentionCount === 1 ? "" : "s"}`}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Gauge}
            label="Crew utilization"
            value={`${averageUtilization}%`}
            description={`${formatHours(totalScheduledMinutes)} scheduled`}
          />

          <MetricCard
            icon={AlertTriangle}
            label="Overloaded crew-days"
            value={String(overloadedDays.length)}
            description="Above configured daily capacity"
            tone={overloadedDays.length > 0 ? "warning" : "default"}
          />

          <MetricCard
            icon={TrendingUp}
            label="Open capacity"
            value={String(openCapacityDays.length)}
            description={`Weekdays below ${OPEN_CAPACITY_THRESHOLD}% utilized`}
          />

          <MetricCard
            icon={Users}
            label="Unassigned schedules"
            value={String(unassignedSchedules.length)}
            description="Active events without assigned crew"
            href={
              unassignedSchedules.length > 0
                ? buildCalendarHref({
                    view,
                    anchorDate,
                    unassigned: true,
                  })
                : undefined
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/10 p-3">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick actions
          </span>

          <Link
            href={buildCalendarHref({
              view,
              anchorDate,
            })}
            className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            Show all
          </Link>

          {unassignedSchedules.length > 0 ? (
            <Link
              href={buildCalendarHref({
                view,
                anchorDate,
                unassigned: true,
              })}
              className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Unassigned work
            </Link>
          ) : null}

          {firstOverloadedDay ? (
            <Link
              href={buildCalendarHref({
                view: "day",
                anchorDate: dateKey(firstOverloadedDay.date),
                crewMemberId: firstOverloadedDay.crewMemberId,
              })}
              className="rounded-full border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/10"
            >
              First overload
            </Link>
          ) : null}

          {bestOpenCapacityDay ? (
            <Link
              href={buildCalendarHref({
                view: "day",
                anchorDate: dateKey(bestOpenCapacityDay.date),
                crewMemberId: bestOpenCapacityDay.crewMemberId,
              })}
              className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Best open capacity
            </Link>
          ) : null}

          {firstAttentionJob ? (
            <Link
              href={`/jobs/${firstAttentionJob.id}`}
              className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
            >
              Next backlog risk
            </Link>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Crew utilization</h3>
              <p className="text-sm text-muted-foreground">
                Scheduled workload compared with each crew member&apos;s configured
                capacity for this calendar view.
              </p>
            </div>

            {crewUtilization.length === 0 ? (
              <EmptyPanel message="No active crew members available." />
            ) : (
              <div className="space-y-3">
                {crewUtilization.map((crew) => (
                  <CrewUtilizationRow
                    key={crew.crewMemberId}
                    crew={crew}
                    view={view}
                    anchorDate={anchorDate}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-semibold">Attention needed</h3>
              <p className="text-sm text-muted-foreground">
                Current dispatch risks based on backlog age, dates, priority, and
                capacity.
              </p>
            </div>

            <div className="space-y-2">
              <RiskRow
                icon={AlertTriangle}
                label="Over capacity"
                count={overloadedDays.length}
                description="Crew-days above configured capacity"
                tone={overloadedDays.length > 0 ? "warning" : "default"}
              />

              <RiskRow
                icon={CalendarClock}
                label="Late backlog"
                count={lateBacklog.length}
                description="Unscheduled jobs past their start date"
                jobs={lateBacklog}
              />

              <RiskRow
                icon={Clock3}
                label={`Backlog older than ${BACKLOG_AGING_DAYS} days`}
                count={agingBacklog.length}
                description="Jobs waiting too long for dispatch"
                jobs={agingBacklog}
              />

              <RiskRow
                icon={AlertTriangle}
                label="High-priority backlog"
                count={priorityBacklog.length}
                description="High or urgent jobs still waiting"
                jobs={priorityBacklog}
              />

              <RiskRow
                icon={Users}
                label="Unassigned scheduled work"
                count={unassignedSchedules.length}
                description="Scheduled events with no crew"
                href={
                  unassignedSchedules.length > 0
                    ? buildCalendarHref({
                        view,
                        anchorDate,
                        unassigned: true,
                      })
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        {overloadedDays.length > 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

              <div className="min-w-0 flex-1">
                <p className="font-medium">Overloaded crew-days</p>

                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {overloadedDays.slice(0, 6).map((day) => (
                    <Link
                      key={`${day.crewMemberId}-${dateKey(day.date)}`}
                      href={buildCalendarHref({
                        view: "day",
                        anchorDate: dateKey(day.date),
                        crewMemberId: day.crewMemberId,
                      })}
                      className="rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-muted/30"
                    >
                      <p className="font-medium">{day.crewName}</p>
                      <p className="mt-1 text-muted-foreground">
                        {formatDisplayDate(day.date)} ·{" "}
                        {formatHours(day.scheduledMinutes)} /{" "}
                        {formatHours(day.capacityMinutes)}
                      </p>
                      <p className="mt-1 font-medium text-amber-700">
                        {day.utilizationPercent}% utilized
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  description,
  tone = "default",
  href,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  description: string;
  tone?: "default" | "warning";
  href?: string;
}) {
  const content = (
    <div
      className={`rounded-xl border p-4 ${
        tone === "warning" ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/10"
      } ${href ? "transition-colors hover:bg-muted/30" : ""}`}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>

      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function CrewUtilizationRow({
  crew,
  view,
  anchorDate,
}: {
  crew: CrewUtilization;
  view: "month" | "week" | "day";
  anchorDate: string;
}) {
  const width = Math.min(crew.utilizationPercent, 100);

  return (
    <Link
      href={buildCalendarHref({
        view,
        anchorDate,
        crewMemberId: crew.crewMemberId,
      })}
      className="block rounded-xl border p-4 transition-colors hover:bg-muted/20"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="font-medium">{crew.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatHours(crew.scheduledMinutes)} scheduled /{" "}
            {formatHours(crew.capacityMinutes)} capacity
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p
            className={`font-semibold ${
              crew.utilizationPercent > 100 ? "text-amber-700" : ""
            }`}
          >
            {crew.utilizationPercent}%
          </p>

          <p className="text-xs text-muted-foreground">
            {crew.overloadedDays > 0
              ? `${crew.overloadedDays} overloaded day${
                  crew.overloadedDays === 1 ? "" : "s"
                }`
              : crew.openCapacityDays > 0
                ? `${crew.openCapacityDays} open-capacity day${
                    crew.openCapacityDays === 1 ? "" : "s"
                  }`
                : "Balanced"}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${
            crew.utilizationPercent > 100 ? "bg-amber-600" : "bg-foreground/70"
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </Link>
  );
}

function RiskRow({
  icon: Icon,
  label,
  count,
  description,
  tone = "default",
  jobs,
  href,
}: {
  icon: typeof AlertTriangle;
  label: string;
  count: number;
  description: string;
  tone?: "default" | "warning";
  jobs?: Job[];
  href?: string;
}) {
  const row = (
    <div
      className={`rounded-xl border p-3 ${
        tone === "warning" && count > 0
          ? "border-amber-500/30 bg-amber-500/5"
          : "bg-muted/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

          <div className="min-w-0">
            <p className="text-sm font-medium">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <span className="rounded-full border px-2 py-0.5 text-xs font-medium">
          {count}
        </span>
      </div>

      {jobs && jobs.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {jobs.slice(0, 3).map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="max-w-full truncate rounded-full border bg-background px-2 py-1 text-xs hover:bg-muted/30"
            >
              {job.name}
            </Link>
          ))}

          {jobs.length > 3 ? (
            <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">
              +{jobs.length - 3} more
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="block transition-opacity hover:opacity-80">
      {row}
    </Link>
  ) : (
    row
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function calculateCrewUtilization(
  crewMember: CrewMember,
  days: CrewDayUtilization[],
): CrewUtilization {
  const crewDays = days.filter((day) => day.crewMemberId === crewMember.id);

  const scheduledMinutes = crewDays.reduce(
    (total, day) => total + day.scheduledMinutes,
    0,
  );

  const capacityMinutes = crewDays.reduce((total, day) => total + day.capacityMinutes, 0);

  return {
    crewMemberId: crewMember.id,
    name: crewMemberName(crewMember),
    scheduledMinutes,
    capacityMinutes,
    utilizationPercent:
      capacityMinutes > 0 ? Math.round((scheduledMinutes / capacityMinutes) * 100) : 0,
    overloadedDays: crewDays.filter((day) => day.utilizationPercent > 100).length,
    openCapacityDays: crewDays.filter(
      (day) => day.operationalDay && day.utilizationPercent < OPEN_CAPACITY_THRESHOLD,
    ).length,
  };
}

function calculateCrewDayUtilization(
  crewMember: CrewMember,
  date: Date,
  schedules: JobSchedule[],
  defaultCapacityMinutes: number,
): CrewDayUtilization {
  const operationalDay = isOperationalDay(date);

  const configuredCapacityMinutes =
    crewMember.dailyCapacityMinutes ?? defaultCapacityMinutes;

  const capacityMinutes = operationalDay ? configuredCapacityMinutes : 0;

  const assignedSchedules = schedules.filter((schedule) =>
    schedule.crewMembers.some((assignment) => assignment.crewMember.id === crewMember.id),
  );

  const hasAllDaySchedule = assignedSchedules.some(
    (schedule) =>
      schedule.allDay &&
      schedule.status !== "CANCELLED" &&
      scheduleOverlapsLocalDate(schedule, date),
  );

  const timedMinutes = assignedSchedules.reduce((total, schedule) => {
    if (schedule.status === "CANCELLED" || schedule.allDay || !schedule.endAt) {
      return total;
    }

    return total + scheduleMinutesForDate(schedule, date);
  }, 0);

  const scheduledMinutes = hasAllDaySchedule
    ? Math.max(configuredCapacityMinutes, timedMinutes)
    : timedMinutes;

  return {
    crewMemberId: crewMember.id,
    crewName: crewMemberName(crewMember),
    date,
    scheduledMinutes,
    capacityMinutes,
    utilizationPercent:
      capacityMinutes > 0 ? Math.round((scheduledMinutes / capacityMinutes) * 100) : 0,
    operationalDay,
  };
}

function scheduleMinutesForDate(schedule: JobSchedule, date: Date) {
  if (!schedule.endAt) return 0;

  const start = new Date(schedule.startAt).getTime();
  const end = new Date(schedule.endAt).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  const dayStart = startOfLocalDay(date).getTime();
  const nextDayStart = addLocalDays(startOfLocalDay(date), 1).getTime();

  const visibleStart = Math.max(start, dayStart);
  const visibleEnd = Math.min(end, nextDayStart);

  if (visibleEnd <= visibleStart) return 0;

  return Math.round((visibleEnd - visibleStart) / 60_000);
}

function scheduleOverlapsLocalDate(schedule: JobSchedule, date: Date) {
  const start = new Date(schedule.startAt).getTime();

  if (Number.isNaN(start)) return false;

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

function buildLocalDates(start: Date, end: Date) {
  const dates: Date[] = [];

  let current = startOfLocalDay(start);
  const finalDay = startOfLocalDay(end);

  while (current.getTime() <= finalDay.getTime()) {
    dates.push(current);
    current = addLocalDays(current, 1);
  }

  return dates;
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

function isOperationalDay(date: Date) {
  const day = date.getDay();

  return day >= 1 && day <= 5;
}

function crewMemberName(crewMember: { firstName: string; lastName: string | null }) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(" ");
}

function formatHours(minutes: number) {
  const hours = minutes / 60;

  return `${new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: Number.isInteger(hours) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(hours)}h`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildCalendarHref({
  view,
  anchorDate,
  crewMemberId,
  unassigned,
}: {
  view: "month" | "week" | "day";
  anchorDate: string;
  crewMemberId?: string;
  unassigned?: boolean;
}) {
  const params = new URLSearchParams();

  params.set("view", view);
  params.set("date", anchorDate);

  if (crewMemberId) params.set("crew", crewMemberId);
  if (unassigned) params.set("unassigned", "true");

  return `/calendar?${params.toString()}`;
}
