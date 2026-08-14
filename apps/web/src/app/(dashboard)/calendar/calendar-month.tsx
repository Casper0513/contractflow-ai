"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import type { JobSchedule } from "@/lib/job-schedules-api";

import { CalendarDetailsPanel } from "./calendar-details-panel";
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

  const [selectedSchedule, setSelectedSchedule] = useState<JobSchedule | null>(null);

  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    schedules: JobSchedule[];
  } | null>(null);

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

  function openEvent(schedule: JobSchedule) {
    setSelectedDay(null);
    setSelectedSchedule(schedule);
  }

  function openDay(day: CalendarDay) {
    setSelectedSchedule(null);

    setSelectedDay({
      date: day.date,
      schedules: day.schedules,
    });
  }

  function closePanel() {
    setSelectedSchedule(null);
    setSelectedDay(null);
  }

  return (
    <>
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
              <DesktopDay
                key={day.key}
                day={day}
                month={month}
                onEventClick={openEvent}
                onDayClick={openDay}
              />
            ))}
          </div>

          <div className="divide-y md:hidden">
            {days
              .filter((day) => day.date.getMonth() === month - 1)
              .map((day) => (
                <MobileDay
                  key={day.key}
                  day={day}
                  onEventClick={openEvent}
                  onDayClick={openDay}
                />
              ))}
          </div>
        </div>
      </div>

      <CalendarDetailsPanel
        schedule={selectedSchedule}
        daySchedules={selectedDay?.schedules}
        dayDate={selectedDay?.date}
        onClose={closePanel}
      />
    </>
  );
}

type CalendarDay = {
  key: string;
  date: Date;
  schedules: JobSchedule[];
};

function DesktopDay({
  day,
  month,
  onEventClick,
  onDayClick,
}: {
  day: CalendarDay;
  month: number;
  onEventClick: (schedule: JobSchedule) => void;
  onDayClick: (day: CalendarDay) => void;
}) {
  const inCurrentMonth = day.date.getMonth() === month - 1;

  const today = isToday(day.date);

  return (
    <div
      className={`min-h-36 border-b border-r p-2 last:border-r-0 ${
        inCurrentMonth ? "bg-background" : "bg-muted/20"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onDayClick(day)}
          aria-label={`Open schedule for ${day.date.toLocaleDateString("en-CA", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}`}
          className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-xs font-medium transition-colors ${
            today
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : inCurrentMonth
                ? "text-foreground hover:bg-muted"
                : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {day.date.getDate()}
        </button>

        {day.schedules.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            {day.schedules.length}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {day.schedules.slice(0, 4).map((schedule) => (
          <CalendarEvent
            key={schedule.id}
            schedule={schedule}
            compact
            onClick={onEventClick}
          />
        ))}

        {day.schedules.length > 4 && (
          <button
            type="button"
            onClick={() => onDayClick(day)}
            className="px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            +{day.schedules.length - 4} more
          </button>
        )}
      </div>
    </div>
  );
}

function MobileDay({
  day,
  onEventClick,
  onDayClick,
}: {
  day: CalendarDay;
  onEventClick: (schedule: JobSchedule) => void;
  onDayClick: (day: CalendarDay) => void;
}) {
  return (
    <div className="p-4">
      <button
        type="button"
        onClick={() => onDayClick(day)}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
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

        {day.schedules.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {day.schedules.length} event
            {day.schedules.length === 1 ? "" : "s"}
          </span>
        )}
      </button>

      {day.schedules.length > 0 ? (
        <div className="space-y-2">
          {day.schedules.map((schedule) => (
            <CalendarEvent key={schedule.id} schedule={schedule} onClick={onEventClick} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No events scheduled.</p>
      )}
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
