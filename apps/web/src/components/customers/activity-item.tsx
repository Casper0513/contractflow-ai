"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  FileText,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";

import type { CustomerActivity } from "@/lib/customers-api";
import { formatDateTime, formatRelativeTime } from "@/lib/activity-utils";

import { ActivityIcon } from "./activity-icon";

type ActivityChange = {
  oldValue: string | null;
  newValue: string | null;
};

type ActivityMetadata = {
  changes?: Record<string, ActivityChange>;
  changedFields?: string[];
};

type ActivityItemProps = {
  activity: CustomerActivity;
  showConnector: boolean;
};

export function ActivityItem({ activity, showConnector }: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [relativeTime, setRelativeTime] = useState<string | null>(null);

  const actorName = getActorName(activity.actor);
  const metadata = getMetadata(activity.metadata);

  const detailedChanges = metadata.changes ? Object.entries(metadata.changes) : [];

  const hasDetailedChanges = detailedChanges.length > 0;

  const hasLegacyChangedFields =
    !hasDetailedChanges && metadata.changedFields && metadata.changedFields.length > 0;

  useEffect(() => {
    const updateRelativeTime = () => {
      setRelativeTime(formatRelativeTime(activity.createdAt));
    };

    updateRelativeTime();

    const interval = window.setInterval(updateRelativeTime, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activity.createdAt]);

  return (
    <div className="relative flex gap-4 pb-7">
      {showConnector && (
        <div className="absolute left-5 top-10 h-[calc(100%-0.75rem)] w-px bg-border" />
      )}

      <div className="relative z-10 shrink-0">
        <ActivityIcon type={activity.type} />
      </div>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">{activity.title}</p>

            {hasDetailedChanges && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {detailedChanges.length} field
                {detailedChanges.length === 1 ? "" : "s"} changed
              </p>
            )}
          </div>

          <span className="text-xs text-muted-foreground">{relativeTime ?? "—"}</span>
        </div>

        {activity.description && (
          <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
        )}

        {hasDetailedChanges && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show details
                </>
              )}
            </button>

            {expanded && (
              <div className="mt-3 space-y-3 rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Changes
                  </p>

                  <span className="text-xs text-muted-foreground">
                    {detailedChanges.length} total
                  </span>
                </div>

                {detailedChanges.map(([field, change]) => {
                  const fieldVisual = getFieldVisual(field);

                  const FieldIcon = fieldVisual.icon;

                  return (
                    <div
                      key={field}
                      className="rounded-lg border bg-background p-3 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                          <FieldIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>

                        <p className="text-sm font-medium">{fieldVisual.label}</p>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                        <div className="rounded-md bg-muted/40 p-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            Old
                          </p>

                          <div className="mt-1 break-words text-sm">
                            {formatActivityValue(change.oldValue)}
                          </div>
                        </div>

                        <div
                          className="hidden text-muted-foreground sm:block"
                          aria-hidden="true"
                        >
                          →
                        </div>

                        <div className="rounded-md bg-muted/40 p-2.5">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            New
                          </p>

                          <div className="mt-1 break-words text-sm">
                            {formatActivityValue(change.newValue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {hasLegacyChangedFields && metadata.changedFields && (
          <div className="mt-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Changed fields
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {metadata.changedFields.map((field) => {
                const fieldVisual = getFieldVisual(field);

                const FieldIcon = fieldVisual.icon;

                return (
                  <span
                    key={field}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium shadow-sm"
                  >
                    <FieldIcon className="h-3.5 w-3.5 text-muted-foreground" />

                    {fieldVisual.label}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{formatDateTime(activity.createdAt)}</span>

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
}

function getActorName(actor: CustomerActivity["actor"]) {
  if (!actor) {
    return null;
  }

  const name = [actor.firstName, actor.lastName].filter(Boolean).join(" ");

  return name || actor.email;
}

function getMetadata(metadata: unknown): ActivityMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const value = metadata as Record<string, unknown>;

  const changes = parseChanges(value.changes);

  const changedFields = Array.isArray(value.changedFields)
    ? value.changedFields.filter((field): field is string => typeof field === "string")
    : undefined;

  return {
    changes,
    changedFields,
  };
}

function parseChanges(value: unknown): Record<string, ActivityChange> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const result: Record<string, ActivityChange> = {};

  for (const [field, rawChange] of Object.entries(value)) {
    if (!rawChange || typeof rawChange !== "object" || Array.isArray(rawChange)) {
      continue;
    }

    const change = rawChange as Record<string, unknown>;

    const oldValue = normalizeActivityValue(change.oldValue);

    const newValue = normalizeActivityValue(change.newValue);

    if (oldValue !== undefined && newValue !== undefined) {
      result[field] = {
        oldValue,
        newValue,
      };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeActivityValue(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return undefined;
}

function formatActivityValue(value: string | null) {
  if (!value || value.trim().length === 0) {
    return <span className="italic text-muted-foreground">Empty</span>;
  }

  return value;
}

function getFieldVisual(field: string) {
  switch (field) {
    case "firstName":
      return {
        label: "First name",
        icon: UserRound,
      };

    case "lastName":
      return {
        label: "Last name",
        icon: UserRound,
      };

    case "companyName":
      return {
        label: "Company",
        icon: Building2,
      };

    case "email":
      return {
        label: "Email",
        icon: Mail,
      };

    case "phone":
      return {
        label: "Phone",
        icon: Phone,
      };

    case "notes":
      return {
        label: "Notes",
        icon: FileText,
      };

    default:
      return {
        label: field,
        icon: FileText,
      };
  }
}
