import { CalendarDays, CalendarRange, UserRoundCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCrewMembers } from "@/lib/crew-api";
import {
  getOrganizationSchedules,
  type JobSchedule,
  type JobScheduleType,
} from "@/lib/job-schedules-api";

import { CalendarFilters, type CalendarFilter } from "./calendar-filters";
import { CalendarMonth } from "./calendar-month";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { DispatchBoard } from "./dispatch-board";

type CalendarPageProps = {
  searchParams: Promise<{
    view?: string;
    month?: string;
    date?: string;
    type?: string;
    crew?: string;
    unassigned?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;

  const view = parseView(params.view);

  const monthSelection = parseMonth(params.month, params.date);

  const anchorDate = parseAnchorDate(
    params.date,
    monthSelection.year,
    monthSelection.month,
  );

  const typeFilter = parseTypeFilter(params.type);

  const crewMembers = await getCrewMembers();

  const crewMemberId = resolveCrewMemberId(params.crew, crewMembers);

  const unassigned = params.unassigned === "true";

  const range =
    view === "month"
      ? getCalendarRange(monthSelection.year, monthSelection.month)
      : view === "week"
        ? getWeekRange(anchorDate)
        : getDayRange(anchorDate);

  const schedules = await getOrganizationSchedules({
    from: range.rangeStart.toISOString(),
    to: range.rangeEnd.toISOString(),
    includeCancelled: true,

    crewMemberId: unassigned ? undefined : crewMemberId,
  });

  const filteredSchedules = filterSchedules(schedules, typeFilter, unassigned);

  const assignedSchedules = filteredSchedules.filter(
    (schedule) => schedule.crewMembers.length > 0,
  );

  const unassignedSchedules = filteredSchedules.filter(
    (schedule) => schedule.status !== "CANCELLED" && schedule.crewMembers.length === 0,
  );

  const cancelledSchedules = filteredSchedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  const anchorDateValue = formatDate(anchorDate);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>

        <p className="mt-1 text-muted-foreground">
          View scheduled work, crew assignments, and appointments across all jobs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Events this view"
          value={filteredSchedules.length}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Assigned"
          value={assignedSchedules.length}
          icon={UserRoundCheck}
        />

        <SummaryCard label="Unassigned" value={unassignedSchedules.length} icon={Users} />

        <SummaryCard
          label="Cancelled"
          value={cancelledSchedules.length}
          icon={CalendarRange}
        />
      </div>

      <Card>
        <CardHeader className="space-y-5">
          <CalendarToolbar
            view={view}
            year={monthSelection.year}
            month={monthSelection.month}
            anchorDate={anchorDateValue}
            type={typeFilter === "ALL" ? undefined : typeFilter}
            crewMemberId={unassigned ? undefined : crewMemberId}
            unassigned={unassigned}
          />

          <div className="border-t pt-5">
            <CalendarFilters
              value={typeFilter}
              crewMemberId={unassigned ? undefined : crewMemberId}
              unassigned={unassigned}
              crewMembers={crewMembers}
            />
          </div>
        </CardHeader>

        <CardContent>
          {view === "month" ? (
            <CalendarMonth
              year={monthSelection.year}
              month={monthSelection.month}
              schedules={filteredSchedules}
            />
          ) : (
            <DispatchBoard
              view={view}
              anchorDate={anchorDateValue}
              schedules={filteredSchedules}
              crewMembers={crewMembers}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function filterSchedules(
  schedules: JobSchedule[],
  typeFilter: CalendarFilter,
  unassigned: boolean,
) {
  return schedules.filter((schedule) => {
    if (typeFilter !== "ALL" && schedule.type !== typeFilter) {
      return false;
    }

    if (unassigned && schedule.crewMembers.length > 0) {
      return false;
    }

    return true;
  });
}

function resolveCrewMemberId(
  value: string | undefined,
  crewMembers: Array<{
    id: string;
  }>,
) {
  if (!value) {
    return undefined;
  }

  const exists = crewMembers.some((crewMember) => crewMember.id === value);

  return exists ? value : undefined;
}

function parseView(value?: string): CalendarView {
  if (value === "week" || value === "day") {
    return value;
  }

  return "month";
}

function parseTypeFilter(value?: string): CalendarFilter {
  const types: JobScheduleType[] = [
    "WORK",
    "SITE_VISIT",
    "ESTIMATE",
    "INSPECTION",
    "DELIVERY",
    "MEETING",
    "OTHER",
  ];

  if (value && types.includes(value as JobScheduleType)) {
    return value as JobScheduleType;
  }

  return "ALL";
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof CalendarDays;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />

          <span className="text-sm">{label}</span>
        </div>

        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

function parseMonth(monthValue?: string, dateValue?: string) {
  const date = parseDateValue(dateValue);

  if (date) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    };
  }

  const today = new Date();

  if (!monthValue) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(monthValue);

  if (!match) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  }

  return {
    year,
    month,
  };
}

function parseAnchorDate(value: string | undefined, year: number, month: number) {
  const parsed = parseDateValue(value);

  if (parsed) {
    return parsed;
  }

  const today = new Date();

  if (today.getFullYear() === year && today.getMonth() + 1 === month) {
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  return new Date(year, month - 1, 1);
}

function parseDateValue(value?: string) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getCalendarRange(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);

  const lastDay = new Date(year, month, 0);

  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const sundayOffset = (7 - lastDay.getDay()) % 7;

  const rangeStart = new Date(year, month - 1, 1 - mondayOffset, 0, 0, 0, 0);

  const rangeEnd = new Date(
    year,
    month - 1,
    lastDay.getDate() + sundayOffset,
    23,
    59,
    59,
    999,
  );

  return {
    rangeStart,
    rangeEnd,
  };
}

function getWeekRange(anchor: Date) {
  const mondayOffset = (anchor.getDay() + 6) % 7;

  const rangeStart = new Date(anchor);

  rangeStart.setDate(anchor.getDate() - mondayOffset);

  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(rangeStart);

  rangeEnd.setDate(rangeStart.getDate() + 6);

  rangeEnd.setHours(23, 59, 59, 999);

  return {
    rangeStart,
    rangeEnd,
  };
}

function getDayRange(anchor: Date) {
  const rangeStart = new Date(anchor);

  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date(anchor);

  rangeEnd.setHours(23, 59, 59, 999);

  return {
    rangeStart,
    rangeEnd,
  };
}

function formatDate(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
