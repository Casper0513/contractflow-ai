"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  RotateCcw,
  Search,
  UserRound,
} from "lucide-react";

import {
  completeFollowUpAction,
  reopenFollowUpAction,
} from "@/app/(dashboard)/follow-ups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FollowUp } from "@/lib/follow-ups-api";

type FollowUpsWorkQueueProps = {
  followUps: FollowUp[];
  currentUserId: string;
};

type Filter =
  "ALL" | "MY" | "OVERDUE" | "TODAY" | "UPCOMING" | "UNASSIGNED" | "COMPLETED";

const FILTERS: Array<{
  value: Filter;
  label: string;
}> = [
  {
    value: "ALL",
    label: "All",
  },
  {
    value: "MY",
    label: "My follow-ups",
  },
  {
    value: "OVERDUE",
    label: "Overdue",
  },
  {
    value: "TODAY",
    label: "Due today",
  },
  {
    value: "UPCOMING",
    label: "Upcoming",
  },
  {
    value: "UNASSIGNED",
    label: "Unassigned",
  },
  {
    value: "COMPLETED",
    label: "Completed",
  },
];

export function FollowUpsWorkQueue({
  followUps,
  currentUserId,
}: FollowUpsWorkQueueProps) {
  const [filter, setFilter] = useState<Filter>("ALL");

  const [query, setQuery] = useState("");

  const counts = useMemo(
    () => getCounts(followUps, currentUserId),
    [followUps, currentUserId],
  );

  const visibleFollowUps = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return followUps
      .filter((followUp) => matchesFilter(followUp, filter, currentUserId))
      .filter((followUp) => {
        if (!normalizedQuery) {
          return true;
        }

        const customerName = formatCustomerName(followUp.customer);

        const assignee = userLabel(followUp.assignedTo);

        return [
          followUp.content,
          customerName,
          followUp.customer.companyName,
          assignee,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort(sortFollowUps);
  }, [followUps, filter, query, currentUserId]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, follow-up, or assignee..."
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;

            return (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}

                <span
                  className={
                    active ? "text-primary-foreground/70" : "text-muted-foreground"
                  }
                >
                  {counts[item.value]}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {visibleFollowUps.length === 0 ? (
        <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed">
          <div className="max-w-sm px-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />

            <p className="mt-3 font-medium">No matching follow-ups</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Try another filter or search term.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleFollowUps.map((followUp) => (
            <FollowUpRow
              key={followUp.id}
              followUp={followUp}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpRow({
  followUp,
  currentUserId,
}: {
  followUp: FollowUp;
  currentUserId: string;
}) {
  const overdue = isOverdue(followUp);

  const dueToday = isDueToday(followUp);

  const mine = followUp.assignedTo?.id === currentUserId;

  return (
    <article
      className={`rounded-xl border p-4 ${
        overdue
          ? "border-red-500/30 bg-red-500/5"
          : dueToday
            ? "border-amber-500/30 bg-amber-500/5"
            : followUp.completedAt
              ? "bg-muted/20"
              : "bg-background"
      }`}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-700">
              Follow-up
            </span>

            {mine && !followUp.completedAt && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium">
                Mine
              </span>
            )}

            {overdue && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}

            {dueToday && !followUp.completedAt && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                Due today
              </span>
            )}

            {followUp.completedAt && (
              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700">
                Completed
              </span>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap font-medium leading-6">
            {followUp.content}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              href={`/customers/${followUp.customer.id}`}
              className="font-medium text-primary hover:underline"
            >
              {formatCustomerName(followUp.customer)}
            </Link>

            <span className="flex items-center gap-1 text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />

              {followUp.assignedTo
                ? `Assigned to ${userLabel(followUp.assignedTo)}`
                : "Unassigned"}
            </span>

            {followUp.dueAt && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                Due {formatDate(followUp.dueAt)}
              </span>
            )}

            {!followUp.dueAt && !followUp.completedAt && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                No due date
              </span>
            )}
          </div>

          {followUp.completedAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Completed {new Date(followUp.completedAt).toLocaleString()}
              {followUp.completedBy ? ` by ${userLabel(followUp.completedBy)}` : ""}
            </p>
          )}
        </div>

        <div className="shrink-0">
          {followUp.completedAt ? (
            <form
              action={reopenFollowUpAction.bind(null, followUp.customerId, followUp.id)}
            >
              <Button type="submit" size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Reopen
              </Button>
            </form>
          ) : (
            <form
              action={completeFollowUpAction.bind(null, followUp.customerId, followUp.id)}
            >
              <Button type="submit" size="sm">
                <Check className="h-4 w-4" />
                Complete
              </Button>
            </form>
          )}
        </div>
      </div>
    </article>
  );
}

function getCounts(followUps: FollowUp[], currentUserId: string): Record<Filter, number> {
  return {
    ALL: followUps.length,

    MY: followUps.filter(
      (followUp) => followUp.assignedTo?.id === currentUserId && !followUp.completedAt,
    ).length,

    OVERDUE: followUps.filter(isOverdue).length,

    TODAY: followUps.filter(isDueToday).length,

    UPCOMING: followUps.filter(isUpcoming).length,

    UNASSIGNED: followUps.filter(
      (followUp) => !followUp.assignedTo && !followUp.completedAt,
    ).length,

    COMPLETED: followUps.filter((followUp) => Boolean(followUp.completedAt)).length,
  };
}

function matchesFilter(followUp: FollowUp, filter: Filter, currentUserId: string) {
  switch (filter) {
    case "MY":
      return followUp.assignedTo?.id === currentUserId && !followUp.completedAt;

    case "OVERDUE":
      return isOverdue(followUp);

    case "TODAY":
      return isDueToday(followUp);

    case "UPCOMING":
      return isUpcoming(followUp);

    case "UNASSIGNED":
      return !followUp.assignedTo && !followUp.completedAt;

    case "COMPLETED":
      return Boolean(followUp.completedAt);

    default:
      return true;
  }
}

function isOverdue(followUp: FollowUp) {
  if (followUp.completedAt || !followUp.dueAt) {
    return false;
  }

  return dateKey(new Date(followUp.dueAt)) < dateKey(new Date());
}

function isDueToday(followUp: FollowUp) {
  if (followUp.completedAt || !followUp.dueAt) {
    return false;
  }

  return dateKey(new Date(followUp.dueAt)) === dateKey(new Date());
}

function isUpcoming(followUp: FollowUp) {
  if (followUp.completedAt || !followUp.dueAt) {
    return false;
  }

  return dateKey(new Date(followUp.dueAt)) > dateKey(new Date());
}

function sortFollowUps(first: FollowUp, second: FollowUp) {
  if (first.completedAt && !second.completedAt) {
    return 1;
  }

  if (!first.completedAt && second.completedAt) {
    return -1;
  }

  if (first.dueAt && second.dueAt) {
    return new Date(first.dueAt).getTime() - new Date(second.dueAt).getTime();
  }

  if (first.dueAt) {
    return -1;
  }

  if (second.dueAt) {
    return 1;
  }

  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}

function dateKey(date: Date) {
  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCustomerName(customer: FollowUp["customer"]) {
  const personalName = [customer.firstName, customer.lastName].filter(Boolean).join(" ");

  if (customer.companyName) {
    return personalName
      ? `${personalName} — ${customer.companyName}`
      : customer.companyName;
  }

  return personalName || "Customer";
}

function userLabel(
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null,
) {
  if (!user) {
    return "Unassigned";
  }

  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
}
