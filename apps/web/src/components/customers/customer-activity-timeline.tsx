import {
  Archive,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  History,
  Pencil,
  Receipt,
  RotateCcw,
  Sparkles,
  UserPlus,
} from "lucide-react";

import type { CustomerActivity } from "@/lib/customers-api";

type CustomerActivityTimelineProps = {
  activities: CustomerActivity[];
};

type ActivityMetadata = {
  changedFields?: string[];
};

export function CustomerActivityTimeline({ activities }: CustomerActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <History className="mx-auto h-9 w-9 text-muted-foreground" />

          <p className="mt-3 font-medium">No activity yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Changes to this customer will appear here.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupActivitiesByDay(activities);

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <div className="mb-4 flex items-center gap-3">
            <p className="text-sm font-semibold">{group.label}</p>

            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            {group.activities.map((activity, index) => {
              const visual = getActivityVisual(activity.type);

              const Icon = visual.icon;

              const actorName = getActorName(activity.actor);

              const metadata = getActivityMetadata(activity.metadata);

              return (
                <div key={activity.id} className="relative flex gap-4 pb-7">
                  {index !== group.activities.length - 1 && (
                    <div className="absolute left-5 top-10 h-[calc(100%-0.75rem)] w-px bg-border" />
                  )}

                  <div
                    className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${visual.className}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 pt-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-medium">{activity.title}</p>

                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(activity.createdAt)}
                      </span>
                    </div>

                    {activity.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {activity.description}
                      </p>
                    )}

                    {metadata.changedFields && metadata.changedFields.length > 0 && (
                      <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Changed
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {metadata.changedFields.map((field) => (
                            <span
                              key={field}
                              className="rounded-md border bg-background px-2 py-1 text-xs"
                            >
                              {formatFieldName(field)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{formatExactDate(activity.createdAt)}</span>

                      {actorName && (
                        <>
                          <span>•</span>
                          <span>by {actorName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function getActivityVisual(type: string) {
  switch (type) {
    case "CUSTOMER_CREATED":
      return {
        icon: UserPlus,
        className: "border-green-500/30 bg-green-500/10 text-green-600",
      };

    case "CUSTOMER_UPDATED":
      return {
        icon: Pencil,
        className: "border-blue-500/30 bg-blue-500/10 text-blue-600",
      };

    case "CUSTOMER_ARCHIVED":
      return {
        icon: Archive,
        className: "border-orange-500/30 bg-orange-500/10 text-orange-600",
      };

    case "CUSTOMER_RESTORED":
      return {
        icon: RotateCcw,
        className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
      };

    case "JOB_CREATED":
      return {
        icon: BriefcaseBusiness,
        className: "border-purple-500/30 bg-purple-500/10 text-purple-600",
      };

    case "ESTIMATE_CREATED":
      return {
        icon: FileText,
        className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600",
      };

    case "INVOICE_CREATED":
      return {
        icon: Receipt,
        className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-600",
      };

    case "PAYMENT_RECEIVED":
      return {
        icon: CircleDollarSign,
        className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600",
      };

    case "AI_ACTIVITY":
      return {
        icon: Sparkles,
        className: "border-violet-500/30 bg-violet-500/10 text-violet-600",
      };

    default:
      return {
        icon: History,
        className: "border-muted bg-muted/50 text-muted-foreground",
      };
  }
}

function getActorName(actor: CustomerActivity["actor"]) {
  if (!actor) {
    return null;
  }

  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ");

  return name || actor.email;
}

function getActivityMetadata(metadata: unknown): ActivityMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const value = metadata as Record<string, unknown>;

  const changedFields = Array.isArray(value.changedFields)
    ? value.changedFields.filter((field): field is string => typeof field === "string")
    : undefined;

  return {
    changedFields,
  };
}

function formatFieldName(field: string) {
  const labels: Record<string, string> = {
    firstName: "First name",
    lastName: "Last name",
    companyName: "Company",
    email: "Email",
    phone: "Phone",
    notes: "Notes",
  };

  return labels[field] ?? field;
}

function groupActivitiesByDay(activities: CustomerActivity[]) {
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

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const formatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  const absoluteSeconds = Math.abs(diffSeconds);

  if (absoluteSeconds < 60) {
    return formatter.format(diffSeconds, "second");
  }

  const minutes = Math.round(diffSeconds / 60);

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);

  if (Math.abs(days) < 7) {
    return formatter.format(days, "day");
  }

  const weeks = Math.round(days / 7);

  if (Math.abs(weeks) < 5) {
    return formatter.format(weeks, "week");
  }

  return formatExactDate(value);
}

function formatExactDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isSameDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}
