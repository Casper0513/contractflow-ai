"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { LoaderCircle, Plus, UserRound, UserRoundCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import type { JobSchedule } from "@/lib/job-schedules-api";

type ApiCrewMember = {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  hourlyCostCents: number;
  active: boolean;
};

export function CalendarScheduleCrewManager({
  schedule,
  onChanged,
}: {
  schedule: JobSchedule;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [crew, setCrew] = useState<ApiCrewMember[]>([]);
  const [selectedCrewMemberId, setSelectedCrewMemberId] = useState("");
  const [loadingCrew, setLoadingCrew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !apiUrl) return;

    let cancelled = false;

    async function loadCrew() {
      try {
        const token = await getToken();
        if (!token || cancelled) return;

        const response = await fetch(`${apiUrl}/crew`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Unable to load crew members: ${response.status}`);
        }

        const data = (await response.json()) as ApiCrewMember[];

        if (!cancelled) setCrew(data);
      } catch (loadError) {
        if (!cancelled) {
          console.error("Failed to load crew members", loadError);
          setError("Unable to load crew members.");
        }
      } finally {
        if (!cancelled) setLoadingCrew(false);
      }
    }

    void loadCrew();

    return () => {
      cancelled = true;
    };
  }, [apiUrl, getToken, isLoaded, isSignedIn]);

  const assignedIds = useMemo(
    () => new Set(schedule.crewMembers.map((assignment) => assignment.crewMember.id)),
    [schedule.crewMembers],
  );

  const availableCrew = crew.filter(
    (crewMember) => crewMember.active && !assignedIds.has(crewMember.id),
  );

  async function assignCrewMember() {
    if (!selectedCrewMemberId || !apiUrl || saving || schedule.status === "CANCELLED") {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError("Unable to authenticate this request.");
        return;
      }

      const response = await fetch(
        `${apiUrl}/jobs/${schedule.jobId}/schedules/${schedule.id}/crew`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            crewMemberId: selectedCrewMemberId,
          }),
        },
      );

      const responseData = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;

      if (!response.ok) {
        setError(
          formatApiMessage(responseData?.message, "Unable to assign this crew member."),
        );
        return;
      }

      setSelectedCrewMemberId("");
      router.refresh();
      onChanged();
    } catch (assignError) {
      console.error("Failed to assign crew member", assignError);
      setError("Unable to assign this crew member.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCrewMember(crewMemberId: string) {
    if (!apiUrl || saving) return;

    setSaving(true);
    setError(null);

    try {
      const token = await getToken();

      if (!token) {
        setError("Unable to authenticate this request.");
        return;
      }

      const response = await fetch(
        `${apiUrl}/jobs/${schedule.jobId}/schedules/${schedule.id}/crew/${crewMemberId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      const responseData = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;

      if (!response.ok) {
        setError(
          formatApiMessage(responseData?.message, "Unable to remove this crew member."),
        );
        return;
      }

      router.refresh();
      onChanged();
    } catch (removeError) {
      console.error("Failed to remove crew member", removeError);
      setError("Unable to remove this crew member.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border bg-muted/10 p-4">
      <div className="flex items-center gap-2">
        <UserRoundCheck className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Assigned crew</p>
      </div>

      {schedule.crewMembers.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" />
          <span>No crew assigned.</span>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {schedule.crewMembers.map((assignment) => {
            const crewMember = assignment.crewMember;

            return (
              <div
                key={assignment.id}
                className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm"
              >
                <span>{crewMemberName(crewMember)}</span>

                {!crewMember.active ? (
                  <span className="text-xs text-muted-foreground">Inactive</span>
                ) : null}

                {schedule.status !== "CANCELLED" ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void removeCrewMember(crewMember.id)}
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    aria-label={`Remove ${crewMemberName(crewMember)}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {schedule.status !== "CANCELLED" ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedCrewMemberId}
            disabled={saving || loadingCrew}
            onChange={(event) => {
              setSelectedCrewMemberId(event.target.value);
              setError(null);
            }}
            className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">
              {loadingCrew
                ? "Loading crew..."
                : availableCrew.length === 0
                  ? "No available crew"
                  : "Select crew member"}
            </option>

            {availableCrew.map((crewMember) => (
              <option key={crewMember.id} value={crewMember.id}>
                {crewMemberName(crewMember)}
              </option>
            ))}
          </select>

          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving || loadingCrew || !selectedCrewMemberId}
            onClick={() => void assignCrewMember()}
          >
            {saving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Assign crew
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function crewMemberName(crewMember: { firstName: string; lastName: string | null }) {
  return [crewMember.firstName, crewMember.lastName].filter(Boolean).join(" ");
}

function formatApiMessage(message: string | string[] | undefined, fallback: string) {
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.join(" ");
  return fallback;
}
