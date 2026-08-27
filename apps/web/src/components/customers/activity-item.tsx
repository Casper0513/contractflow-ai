"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileClock,
  FileText,
  Mail,
  Phone,
  ReceiptText,
  RotateCcw,
  Send,
  UserRound,
  XCircle,
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

  customerId?: string;
  jobId?: string;
  jobName?: string;

  estimateId?: string;
  estimateNumber?: string;

  invoiceId?: string;
  invoiceNumber?: string;

  paymentId?: string;
};

type ActivityItemProps = {
  activity: CustomerActivity;
  showConnector: boolean;
};

type ActivityVisual = {
  label: string | null;
  icon: typeof CheckCircle2;
  badgeClassName: string;
  containerClassName: string;
};

type ActivityLink = {
  href: string;
  label: string;
};

export function ActivityItem({ activity, showConnector }: ActivityItemProps) {
  const [expanded, setExpanded] = useState(false);

  const [relativeTime, setRelativeTime] = useState<string | null>(null);

  const actorName = getActorName(activity.actor);

  const metadata = getMetadata(activity.metadata);

  const activityLink = getActivityLink(activity.type, metadata);

  const detailedChanges = metadata.changes ? Object.entries(metadata.changes) : [];

  const hasDetailedChanges = detailedChanges.length > 0;

  const hasLegacyChangedFields =
    !hasDetailedChanges && metadata.changedFields && metadata.changedFields.length > 0;

  const visual = getActivityVisual(activity.type);

  const VisualIcon = visual.icon;

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
        <div
          className={`rounded-xl border border-transparent p-3 transition-colors ${visual.containerClassName}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{activity.title}</p>

                {visual.label && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${visual.badgeClassName}`}
                  >
                    <VisualIcon className="h-3 w-3" />

                    {visual.label}
                  </span>
                )}
              </div>

              {hasDetailedChanges && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {detailedChanges.length} field
                  {detailedChanges.length === 1 ? "" : "s"} changed
                </p>
              )}
            </div>

            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime ?? "—"}
            </span>
          </div>

          {activity.description && (
            <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
          )}

          {activityLink && (
            <div className="mt-3">
              <Link
                href={activityLink.href}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-muted"
              >
                {activityLink.label}

                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
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
    </div>
  );
}

function getActivityLink(type: string, metadata: ActivityMetadata): ActivityLink | null {
  /*
   * Payment events intentionally link to their
   * parent invoice because payments are managed
   * from the invoice workspace.
   */
  if (type.startsWith("PAYMENT_") && metadata.invoiceId) {
    return {
      href: `/invoices/${metadata.invoiceId}`,
      label: metadata.invoiceNumber ? `View ${metadata.invoiceNumber}` : "View invoice",
    };
  }

  if (type.startsWith("INVOICE_") && metadata.invoiceId) {
    return {
      href: `/invoices/${metadata.invoiceId}`,
      label: metadata.invoiceNumber ? `View ${metadata.invoiceNumber}` : "View invoice",
    };
  }

  if (type.startsWith("ESTIMATE_") && metadata.estimateId) {
    return {
      href: `/estimates/${metadata.estimateId}`,
      label: metadata.estimateNumber
        ? `View ${metadata.estimateNumber}`
        : "View estimate",
    };
  }

  if (isJobActivity(type) && metadata.jobId) {
    return {
      href: `/jobs/${metadata.jobId}`,
      label: metadata.jobName ? `View ${metadata.jobName}` : "View job",
    };
  }

  return null;
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

function getActivityVisual(type: string): ActivityVisual {
  switch (type) {
    case "PAYMENT_RECEIVED":
      return {
        label: "Payment received",
        icon: CircleDollarSign,
        badgeClassName: "border-green-500/30 bg-green-500/10 text-green-700",
        containerClassName: "border-green-500/20 bg-green-500/[0.03]",
      };

    case "PAYMENT_VOIDED":
      return {
        label: "Payment voided",
        icon: XCircle,
        badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700",
        containerClassName: "border-red-500/20 bg-red-500/[0.03]",
      };

    case "INVOICE_CREATED":
      return {
        label: "Invoice created",
        icon: ReceiptText,
        badgeClassName: "border-border bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "INVOICE_SENT":
      return {
        label: "Invoice sent",
        icon: Send,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "border-blue-500/20 bg-blue-500/[0.03]",
      };

    case "INVOICE_VIEWED":
      return {
        label: "Invoice viewed",
        icon: ReceiptText,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "INVOICE_PARTIALLY_PAID":
      return {
        label: "Partially paid",
        icon: Banknote,
        badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-700",
        containerClassName: "border-amber-500/20 bg-amber-500/[0.03]",
      };

    case "INVOICE_PAID":
      return {
        label: "Invoice paid",
        icon: CheckCircle2,
        badgeClassName: "border-green-500/30 bg-green-500/10 text-green-700",
        containerClassName: "border-green-500/20 bg-green-500/[0.03]",
      };

    case "INVOICE_OVERDUE":
      return {
        label: "Overdue",
        icon: AlertTriangle,
        badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700",
        containerClassName: "border-red-500/20 bg-red-500/[0.03]",
      };

    case "INVOICE_VOIDED":
      return {
        label: "Invoice voided",
        icon: XCircle,
        badgeClassName: "border-muted bg-muted text-muted-foreground",
        containerClassName: "bg-muted/[0.15]",
      };

    case "ESTIMATE_CREATED":
      return {
        label: "Estimate created",
        icon: FileText,
        badgeClassName: "border-border bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "ESTIMATE_SENT":
      return {
        label: "Estimate sent",
        icon: Send,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "border-blue-500/20 bg-blue-500/[0.03]",
      };

    case "ESTIMATE_VIEWED":
      return {
        label: "Estimate viewed",
        icon: FileClock,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "ESTIMATE_APPROVED":
      return {
        label: "Approved",
        icon: FileCheck2,
        badgeClassName: "border-green-500/30 bg-green-500/10 text-green-700",
        containerClassName: "border-green-500/20 bg-green-500/[0.03]",
      };

    case "ESTIMATE_DECLINED":
      return {
        label: "Declined",
        icon: XCircle,
        badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700",
        containerClassName: "border-red-500/20 bg-red-500/[0.03]",
      };

    case "ESTIMATE_EXPIRED":
      return {
        label: "Expired",
        icon: FileClock,
        badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-700",
        containerClassName: "border-amber-500/20 bg-amber-500/[0.03]",
      };

    case "JOB_CREATED":
      return {
        label: "Job created",
        icon: ClipboardList,
        badgeClassName: "border-border bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "JOB_ARCHIVED":
      return {
        label: "Job archived",
        icon: Archive,
        badgeClassName: "border-muted bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "JOB_RESTORED":
      return {
        label: "Job restored",
        icon: RotateCcw,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "TASK_COMPLETED":
      return {
        label: "Task completed",
        icon: CheckCircle2,
        badgeClassName: "border-green-500/30 bg-green-500/10 text-green-700",
        containerClassName: "border-green-500/20 bg-green-500/[0.03]",
      };

    case "TASK_REOPENED":
      return {
        label: "Task reopened",
        icon: RotateCcw,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "TASK_DELETED":
      return {
        label: "Task deleted",
        icon: XCircle,
        badgeClassName: "border-muted bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "JOB_CHECKLIST_ITEM_COMPLETED":
      return {
        label: "Checklist completed",
        icon: ClipboardCheck,
        badgeClassName: "border-green-500/30 bg-green-500/10 text-green-700",
        containerClassName: "border-green-500/20 bg-green-500/[0.03]",
      };

    case "JOB_CHECKLIST_ITEM_REOPENED":
      return {
        label: "Checklist reopened",
        icon: RotateCcw,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "SCHEDULE_CREATED":
      return {
        label: "Scheduled",
        icon: CalendarClock,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "SCHEDULE_UPDATED":
      return {
        label: "Schedule updated",
        icon: CalendarCheck,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "SCHEDULE_CANCELLED":
      return {
        label: "Schedule cancelled",
        icon: CalendarX,
        badgeClassName: "border-red-500/30 bg-red-500/10 text-red-700",
        containerClassName: "border-red-500/20 bg-red-500/[0.03]",
      };

    case "SCHEDULE_RESTORED":
      return {
        label: "Schedule restored",
        icon: RotateCcw,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    case "CUSTOMER_CREATED":
      return {
        label: "Customer created",
        icon: UserRound,
        badgeClassName: "border-border bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "CUSTOMER_ARCHIVED":
      return {
        label: "Customer archived",
        icon: Archive,
        badgeClassName: "border-muted bg-muted text-muted-foreground",
        containerClassName: "",
      };

    case "CUSTOMER_RESTORED":
      return {
        label: "Customer restored",
        icon: RotateCcw,
        badgeClassName: "border-blue-500/30 bg-blue-500/10 text-blue-700",
        containerClassName: "",
      };

    default:
      return {
        label: null,
        icon: FileText,
        badgeClassName: "",
        containerClassName: "",
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

    customerId: getString(value.customerId),

    jobId: getString(value.jobId),
    jobName: getString(value.jobName),

    estimateId: getString(value.estimateId),
    estimateNumber: getString(value.estimateNumber),

    invoiceId: getString(value.invoiceId),
    invoiceNumber: getString(value.invoiceNumber),

    paymentId: getString(value.paymentId),
  };
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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
