import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Rows3 } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CalendarView = "month" | "week" | "day";

type CalendarToolbarProps = {
  view: CalendarView;

  year: number;
  month: number;

  anchorDate: string;

  type?: string;
  crewMemberId?: string;
  unassigned?: boolean;
};

export function CalendarToolbar({
  view,
  year,
  month,
  anchorDate,
  type,
  crewMemberId,
  unassigned = false,
}: CalendarToolbarProps) {
  const anchor = parseLocalDate(anchorDate);

  const previous = getPreviousDate(view, anchor, year, month);

  const next = getNextDate(view, anchor, year, month);

  const today = new Date();

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {formatHeading(view, anchor, year, month)}
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            {view === "month"
              ? "Scheduled work and appointments across your jobs."
              : "Dispatch work across crew members and schedules."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={buildCalendarHref({
                  view,
                  targetDate: previous,
                  type,
                  crewMemberId,
                  unassigned,
                })}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Link>
            }
          />

          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={buildCalendarHref({
                  view,
                  targetDate: today,
                  type,
                  crewMemberId,
                  unassigned,
                })}
              >
                <CalendarDays className="h-4 w-4" />
                Today
              </Link>
            }
          />

          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <Link
                href={buildCalendarHref({
                  view,
                  targetDate: next,
                  type,
                  crewMemberId,
                  unassigned,
                })}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ViewButton
          active={view === "month"}
          href={buildCalendarHref({
            view: "month",
            targetDate: anchor,
            type,
            crewMemberId,
            unassigned,
          })}
          label="Month"
        />

        <ViewButton
          active={view === "week"}
          href={buildCalendarHref({
            view: "week",
            targetDate: anchor,
            type,
            crewMemberId,
            unassigned,
          })}
          label="Week"
        />

        <ViewButton
          active={view === "day"}
          href={buildCalendarHref({
            view: "day",
            targetDate: anchor,
            type,
            crewMemberId,
            unassigned,
          })}
          label="Day"
        />

        {view !== "month" ? (
          <div className="ml-auto hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Rows3 className="h-4 w-4" />
            Crew dispatch view
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      nativeButton={false}
      render={<Link href={href}>{label}</Link>}
    />
  );
}

function buildCalendarHref({
  view,
  targetDate,
  type,
  crewMemberId,
  unassigned = false,
}: {
  view: CalendarView;
  targetDate: Date;
  type?: string;
  crewMemberId?: string;
  unassigned?: boolean;
}) {
  const params = new URLSearchParams();

  params.set("view", view);

  if (view === "month") {
    params.set("month", formatMonth(targetDate));
  } else {
    params.set("date", formatDate(targetDate));
  }

  if (type) {
    params.set("type", type);
  }

  if (unassigned) {
    params.set("unassigned", "true");
  } else if (crewMemberId) {
    params.set("crew", crewMemberId);
  }

  return `/calendar?${params.toString()}`;
}

function getPreviousDate(view: CalendarView, anchor: Date, year: number, month: number) {
  if (view === "month") {
    return new Date(year, month - 2, 1);
  }

  const date = new Date(anchor);

  date.setDate(date.getDate() - (view === "week" ? 7 : 1));

  return date;
}

function getNextDate(view: CalendarView, anchor: Date, year: number, month: number) {
  if (view === "month") {
    return new Date(year, month, 1);
  }

  const date = new Date(anchor);

  date.setDate(date.getDate() + (view === "week" ? 7 : 1));

  return date;
}

function formatHeading(view: CalendarView, anchor: Date, year: number, month: number) {
  if (view === "month") {
    return new Date(year, month - 1, 1).toLocaleDateString("en-CA", {
      month: "long",
      year: "numeric",
    });
  }

  if (view === "day") {
    return anchor.toLocaleDateString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  const dates = buildWeekDates(anchor);

  const start = dates[0];
  const end = dates[6];

  if (start.getFullYear() !== end.getFullYear()) {
    return `${start.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} – ${end.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  if (start.getMonth() !== end.getMonth()) {
    return `${start.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    })} – ${end.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }

  return `${start.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
  })} – ${end.getDate()}, ${end.getFullYear()}`;
}

function buildWeekDates(anchor: Date) {
  const mondayOffset = (anchor.getDay() + 6) % 7;

  const monday = new Date(anchor);

  monday.setDate(anchor.getDate() - mondayOffset);

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

function formatMonth(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function formatDate(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
