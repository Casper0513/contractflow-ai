"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobSchedule } from "@/lib/job-schedules-api";

import { JobScheduleItem } from "./job-schedule-item";

type JobScheduleListProps = {
  jobId: string;
  customerId: string;
  schedules: JobSchedule[];
};

type Filter = "UPCOMING" | "COMPLETED" | "CANCELLED" | "ALL";

export function JobScheduleList({ jobId, customerId, schedules }: JobScheduleListProps) {
  const [filter, setFilter] = useState<Filter>("UPCOMING");

  const filteredSchedules = useMemo(() => {
    switch (filter) {
      case "COMPLETED":
        return schedules.filter((schedule) => schedule.status === "COMPLETED");

      case "CANCELLED":
        return schedules.filter((schedule) => schedule.status === "CANCELLED");

      case "ALL":
        return schedules;

      default:
        return schedules.filter(
          (schedule) =>
            schedule.status === "SCHEDULED" || schedule.status === "IN_PROGRESS",
        );
    }
  }, [filter, schedules]);

  if (schedules.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">Nothing scheduled yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add work, visits, inspections, deliveries, or meetings for this job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterButton
          active={filter === "UPCOMING"}
          onClick={() => setFilter("UPCOMING")}
        >
          Upcoming
        </FilterButton>

        <FilterButton
          active={filter === "COMPLETED"}
          onClick={() => setFilter("COMPLETED")}
        >
          Completed
        </FilterButton>

        <FilterButton
          active={filter === "CANCELLED"}
          onClick={() => setFilter("CANCELLED")}
        >
          Cancelled
        </FilterButton>

        <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All
        </FilterButton>
      </div>

      {filteredSchedules.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No schedule events match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSchedules.map((schedule) => (
            <JobScheduleItem
              key={schedule.id}
              jobId={jobId}
              customerId={customerId}
              schedule={schedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
