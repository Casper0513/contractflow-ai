import { History } from "lucide-react";

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

export function CustomerActivityTimeline({ activities }: CustomerActivityTimelineProps) {
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

  const groups = groupActivitiesByDay(activities);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <ActivityDay key={group.key} label={group.label} activities={group.activities} />
      ))}
    </div>
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
