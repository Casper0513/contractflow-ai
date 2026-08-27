"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  History,
  ReceiptText,
  UserRound,
} from "lucide-react";

import type { CustomerActivity } from "@/lib/customers-api";

import { ActivityDay } from "./activity-day";

type CustomerActivityTimelineProps = {
  activities: CustomerActivity[];
};

type ActivityGroup = {
  key: string;
  label: string;
  activities: CustomerActivity[];
};

type ActivityFilter = "ALL" | "CUSTOMER" | "JOBS" | "ESTIMATES" | "INVOICES" | "PAYMENTS";

type FilterDefinition = {
  value: ActivityFilter;
  label: string;
  icon: typeof History;
};

const FILTERS: FilterDefinition[] = [
  {
    value: "ALL",
    label: "All",
    icon: History,
  },
  {
    value: "CUSTOMER",
    label: "Customer",
    icon: UserRound,
  },
  {
    value: "JOBS",
    label: "Jobs",
    icon: BriefcaseBusiness,
  },
  {
    value: "ESTIMATES",
    label: "Estimates",
    icon: FileText,
  },
  {
    value: "INVOICES",
    label: "Invoices",
    icon: ReceiptText,
  },
  {
    value: "PAYMENTS",
    label: "Payments",
    icon: CircleDollarSign,
  },
];

export function CustomerActivityTimeline({ activities }: CustomerActivityTimelineProps) {
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>("ALL");

  const counts = useMemo(() => getFilterCounts(activities), [activities]);

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => matchesActivityFilter(activity.type, activeFilter)),
    [activities, activeFilter],
  );

  if (activities.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <History className="mx-auto h-9 w-9 text-muted-foreground" />

          <p className="mt-3 font-medium">No activity yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Customer changes, jobs, estimates, invoices, payments, and other activity will
            appear here.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupActivitiesByDay(filteredActivities);

  return (
    <div className="space-y-6">
      <ActivityFilters
        activeFilter={activeFilter}
        counts={counts}
        onChange={setActiveFilter}
      />

      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{filteredActivities.length}</span>{" "}
          {filteredActivities.length === 1 ? "activity" : "activities"}
        </p>

        {activeFilter !== "ALL" && (
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear filter
          </button>
        )}
      </div>

      {filteredActivities.length === 0 ? (
        <FilteredEmptyState filter={activeFilter} />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <ActivityDay
              key={group.key}
              label={group.label}
              activities={group.activities}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityFilters({
  activeFilter,
  counts,
  onChange,
}: {
  activeFilter: ActivityFilter;
  counts: Record<ActivityFilter, number>;
  onChange: (filter: ActivityFilter) => void;
}) {
  return (
    <div>
      <div className="mb-3">
        <p className="font-medium">Filter activity</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Focus the timeline on a specific part of the customer relationship.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const Icon = filter.icon;

          const active = activeFilter === filter.value;

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => onChange(filter.value)}
              aria-pressed={active}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />

              <span>{filter.label}</span>

              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  active ? "bg-background/15" : "bg-muted"
                }`}
              >
                {counts[filter.value]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilteredEmptyState({ filter }: { filter: ActivityFilter }) {
  const definition = FILTERS.find((candidate) => candidate.value === filter);

  const Icon = definition?.icon ?? History;

  const label = definition?.label ?? "activity";

  return (
    <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
      <div className="max-w-sm px-6 text-center">
        <Icon className="mx-auto h-8 w-8 text-muted-foreground" />

        <p className="mt-3 font-medium">No {label.toLowerCase()} activity</p>

        <p className="mt-1 text-sm text-muted-foreground">
          There are no matching timeline events for this customer yet.
        </p>
      </div>
    </div>
  );
}

function getFilterCounts(activities: CustomerActivity[]): Record<ActivityFilter, number> {
  const counts: Record<ActivityFilter, number> = {
    ALL: activities.length,
    CUSTOMER: 0,
    JOBS: 0,
    ESTIMATES: 0,
    INVOICES: 0,
    PAYMENTS: 0,
  };

  for (const activity of activities) {
    if (matchesActivityFilter(activity.type, "CUSTOMER")) {
      counts.CUSTOMER += 1;
    }

    if (matchesActivityFilter(activity.type, "JOBS")) {
      counts.JOBS += 1;
    }

    if (matchesActivityFilter(activity.type, "ESTIMATES")) {
      counts.ESTIMATES += 1;
    }

    if (matchesActivityFilter(activity.type, "INVOICES")) {
      counts.INVOICES += 1;
    }

    if (matchesActivityFilter(activity.type, "PAYMENTS")) {
      counts.PAYMENTS += 1;
    }
  }

  return counts;
}

function matchesActivityFilter(type: string, filter: ActivityFilter) {
  if (filter === "ALL") {
    return true;
  }

  if (filter === "CUSTOMER") {
    return type.startsWith("CUSTOMER_") || type === "NOTE_ADDED";
  }

  if (filter === "ESTIMATES") {
    return type.startsWith("ESTIMATE_");
  }

  if (filter === "INVOICES") {
    return type.startsWith("INVOICE_");
  }

  if (filter === "PAYMENTS") {
    return type.startsWith("PAYMENT_");
  }

  if (filter === "JOBS") {
    return isJobActivity(type);
  }

  return false;
}

function isJobActivity(type: string) {
  return (
    type.startsWith("JOB_") ||
    type.startsWith("TASK_") ||
    type.startsWith("SCHEDULE_") ||
    type === "DOCUMENT_ADDED" ||
    type === "PHOTO_ADDED" ||
    type === "AI_ACTIVITY"
  );
}

function groupActivitiesByDay(activities: CustomerActivity[]): ActivityGroup[] {
  const groups = new Map<string, CustomerActivity[]>();

  for (const activity of activities) {
    const date = new Date(activity.createdAt);

    const key = [date.getFullYear(), date.getMonth(), date.getDate()].join("-");

    const existing = groups.get(key) ?? [];

    existing.push(activity);

    groups.set(key, existing);
  }

  return Array.from(groups.entries()).map(([key, groupedActivities]) => ({
    key,
    label: formatDayLabel(groupedActivities[0].createdAt),
    activities: groupedActivities,
  }));
}

function formatDayLabel(value: string) {
  const date = new Date(value);

  const now = new Date();

  if (isSameDay(date, now)) {
    return "Today";
  }

  const yesterday = new Date(now);

  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, yesterday)) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
