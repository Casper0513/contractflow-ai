"use client";

import type { JobScheduleType } from "@/lib/job-schedules-api";

export type CalendarFilter = "ALL" | JobScheduleType;

type CalendarFiltersProps = {
  value: CalendarFilter;
  onChange: (value: CalendarFilter) => void;
};

const filters: Array<{
  value: CalendarFilter;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All",
  },
  {
    value: "WORK",
    label: "Work",
  },
  {
    value: "SITE_VISIT",
    label: "Site visits",
  },
  {
    value: "ESTIMATE",
    label: "Estimates",
  },
  {
    value: "INSPECTION",
    label: "Inspections",
  },
  {
    value: "DELIVERY",
    label: "Deliveries",
  },
  {
    value: "MEETING",
    label: "Meetings",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

export function CalendarFilters({ value, onChange }: CalendarFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const active = filter.value === value;

        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}
