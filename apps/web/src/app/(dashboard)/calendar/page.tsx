import { CalendarDays, CalendarRange } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getOrganizationSchedules } from "@/lib/job-schedules-api";

import { CalendarMonth } from "./calendar-month";
import { CalendarToolbar } from "./calendar-toolbar";

type CalendarPageProps = {
  searchParams: Promise<{
    month?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { month: monthParam } = await searchParams;

  const { year, month } = parseMonth(monthParam);

  const { rangeStart, rangeEnd } = getCalendarRange(year, month);

  const schedules = await getOrganizationSchedules({
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    includeCancelled: true,
  });

  const activeSchedules = schedules.filter((schedule) => schedule.status !== "CANCELLED");

  const completedSchedules = schedules.filter(
    (schedule) => schedule.status === "COMPLETED",
  );

  const cancelledSchedules = schedules.filter(
    (schedule) => schedule.status === "CANCELLED",
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>

        <p className="mt-1 text-muted-foreground">
          View scheduled work and appointments across all jobs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Events this view"
          value={schedules.length}
          icon={CalendarDays}
        />

        <SummaryCard label="Active" value={activeSchedules.length} icon={CalendarRange} />

        <SummaryCard
          label="Completed"
          value={completedSchedules.length}
          icon={CalendarDays}
        />

        <SummaryCard
          label="Cancelled"
          value={cancelledSchedules.length}
          icon={CalendarRange}
        />
      </div>

      <Card>
        <CardHeader>
          <CalendarToolbar year={year} month={month} />
        </CardHeader>

        <CardContent>
          <CalendarMonth year={year} month={month} schedules={schedules} />
        </CardContent>
      </Card>
    </div>
  );
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

function parseMonth(value?: string) {
  const today = new Date();

  if (!value) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    };
  }

  const match = /^(\d{4})-(\d{2})$/.exec(value);

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
