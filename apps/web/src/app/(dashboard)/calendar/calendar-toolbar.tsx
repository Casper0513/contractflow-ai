import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

type CalendarToolbarProps = {
  year: number;
  month: number;
};

export function CalendarToolbar({ year, month }: CalendarToolbarProps) {
  const current = new Date(year, month - 1, 1);

  const previous = new Date(year, month - 2, 1);

  const next = new Date(year, month, 1);

  const today = new Date();

  return (
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          {current.toLocaleDateString("en-CA", {
            month: "long",
            year: "numeric",
          })}
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Scheduled work and appointments across your jobs.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={
            <Link href={`/calendar?month=${formatMonth(previous)}`}>
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
            <Link href={`/calendar?month=${formatMonth(today)}`}>
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
            <Link href={`/calendar?month=${formatMonth(next)}`}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Link>
          }
        />
      </div>
    </div>
  );
}

function formatMonth(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}
