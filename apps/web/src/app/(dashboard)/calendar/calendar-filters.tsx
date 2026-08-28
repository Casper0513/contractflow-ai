"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CrewMember } from "@/lib/crew-api";
import type { JobScheduleType } from "@/lib/job-schedules-api";

export type CalendarFilter = "ALL" | JobScheduleType;

type CalendarFiltersProps = {
  value: CalendarFilter;
  crewMemberId?: string;
  unassigned: boolean;
  crewMembers: CrewMember[];
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

export function CalendarFilters({
  value,
  crewMemberId,
  unassigned,
  crewMembers,
}: CalendarFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, nextValue] of Object.entries(changes)) {
      if (nextValue) {
        params.set(key, nextValue);
      } else {
        params.delete(key);
      }
    }

    const query = params.toString();

    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function changeType(filter: CalendarFilter) {
    updateParams({
      type: filter === "ALL" ? null : filter,
    });
  }

  function changeCrew(nextCrewMemberId: string) {
    updateParams({
      crew: nextCrewMemberId || null,
      unassigned: null,
    });
  }

  function toggleUnassigned() {
    updateParams({
      unassigned: unassigned ? null : "true",
      crew: null,
    });
  }

  function clearFilters() {
    updateParams({
      type: null,
      crew: null,
      unassigned: null,
    });
  }

  const hasFilters = value !== "ALL" || Boolean(crewMemberId) || unassigned;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Event type
        </p>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const active = filter.value === value;

            return (
              <button
                key={filter.value}
                type="button"
                onClick={() => changeType(filter.value)}
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
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="calendar-crew-filter"
            className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Crew member
          </label>

          <select
            id="calendar-crew-filter"
            value={crewMemberId ?? ""}
            disabled={unassigned}
            onChange={(event) => changeCrew(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm lg:max-w-sm"
          >
            <option value="">All crew members</option>

            {crewMembers.map((crewMember) => (
              <option key={crewMember.id} value={crewMember.id}>
                {crewMemberName(crewMember)}
                {!crewMember.active ? " (Inactive)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={unassigned ? "default" : "outline"}
            onClick={toggleUnassigned}
          >
            <Users className="h-4 w-4" />
            Unassigned only
          </Button>

          {hasFilters ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function crewMemberName(crewMember: { firstName: string; lastName: string | null }) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(" ");
}
