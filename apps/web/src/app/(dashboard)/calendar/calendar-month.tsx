"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import type { JobSchedule } from "@/lib/job-schedules-api";

import { CalendarFilters, type CalendarFilter } from "./calendar-filters";
import { CalendarEvent } from "./calendar-event";

type CalendarMonthProps = {
  year: number;
  month: number;
  schedules: JobSchedule[];
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarMonth({ year, month, schedules }: CalendarMonthProps) {
  const [filter, setFilter] = useState<CalendarFilter>("ALL");

  const filteredSchedules = useMemo(() => {
    if (filter === "ALL") {
      return schedules;
    }

    return schedules.filter((schedule) => schedule.type === filter);
  }, [filter, schedules]);

  const days = useMemo(
    () => buildCalendarDays(year, month, filteredSchedules),
    [year, month, filteredSchedules],
  );

  return (
    <div className="space-y-5">
      <CalendarFilters value={filter} onChange={setFilter} />

      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="hidden grid-cols-7 border-b bg-muted/30 md:grid">
          {weekDays.map((day) => (
            <div
              key={day}
              className="border-r px-3 py-2 text-xs font-medium text-muted-foreground last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="hidden grid-cols-7 md:grid">
          {days.map((day) => (
            <DesktopDay key={day.key} day={day} month={month} />
          ))}
        </div>

        <div className="divide-y md:hidden">
          {days
            .filter((day) => day.date.getMonth() === month - 1)
            .map((day) => (
              <MobileDay key={day.key} day={day} />
            ))}
        </div>
      </div>
    </div>
  );
}

type CalendarDay = {
  key: string;
  date: Date;
  schedules: JobSchedule[];
};

function DesktopDay({ day, month }: { day: CalendarDay; month: number }) {
  const inCurrentMonth = day.date.getMonth() === month - 1;

  const today = isToday(day.date);

  return (
    <div
      className={`min-h-36 border-b border-r p-2 last:border-r-0 ${
        inCurrentMonth ? "bg-background" : "bg-muted/20"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-medium ${
            today
              ? "bg-primary text-primary-foreground"
              : inCurrentMonth
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {day.date.getDate()}
        </span>

        {day.schedules.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {day.schedules.length}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {day.schedules.slice(0, 4).map((schedule) => (
          <CalendarEvent key={schedule.id} schedule={schedule} compact />
        ))}

        {day.schedules.length > 4 && (
          <p className="px-1 text-[11px] font-medium text-muted-foreground">
            +{day.schedules.length - 4} more
          </p>
        )}
      </div>
    </div>
  );
}

function MobileDay({ day }: { day: CalendarDay }) {
  if (day.schedules.length === 0) {
    return null;
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />

        <p className="font-medium">
          {day.date.toLocaleDateString("en-CA", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>

        {isToday(day.date) && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
            Today
          </span>
        )}
      </div>

      <div className="space-y-2">
        {day.schedules.map((schedule) => (
          <CalendarEvent key={schedule.id} schedule={schedule} />
        ))}
      </div>
    </div>
  );
}

function buildCalendarDays(
  year: number,
  month: number,
  schedules: JobSchedule[],
): CalendarDay[] {
  const firstDay = new Date(year, month - 1, 1);

  const lastDay = new Date(year, month, 0);

  const mondayOffset = (firstDay.getDay() + 6) % 7;

  const gridStart = new Date(year, month - 1, 1 - mondayOffset);

  const sundayOffset = (7 - lastDay.getDay()) % 7;

  const gridEnd = new Date(year, month - 1, lastDay.getDate() + sundayOffset);

  const schedulesByDay = new Map<string, JobSchedule[]>();

  for (const schedule of schedules) {
    const key = dateKey(new Date(schedule.startAt));

    const existing = schedulesByDay.get(key) ?? [];

    existing.push(schedule);

    schedulesByDay.set(key, existing);
  }

  for (const events of schedulesByDay.values()) {
    events.sort(
      (first, second) =>
        new Date(first.startAt).getTime() - new Date(second.startAt).getTime(),
    );
  }

  const days: CalendarDay[] = [];

  const cursor = new Date(gridStart);

  while (cursor <= gridEnd) {
    const date = new Date(cursor);

    const key = dateKey(date);

    days.push({
      key,
      date,
      schedules: schedulesByDay.get(key) ?? [],
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function dateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isToday(date: Date) {
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
