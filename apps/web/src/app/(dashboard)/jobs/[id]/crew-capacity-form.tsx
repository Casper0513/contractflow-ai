"use client";

import { useActionState, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrewMember } from "@/lib/crew-api";

import { type JobCrewActionState, updateCrewCapacityAction } from "./job-crew-actions";

const initialState: JobCrewActionState = {
  error: null,
  success: false,
};

export function CrewCapacityForm({
  jobId,
  crewMember,
}: {
  jobId: string;
  crewMember: CrewMember;
}) {
  const [state, action, pending] = useActionState(
    updateCrewCapacityAction.bind(null, jobId, crewMember.id),
    initialState,
  );

  const [dailyCapacityMinutes, setDailyCapacityMinutes] = useState(() =>
    crewMember.dailyCapacityMinutes === null
      ? ""
      : String(crewMember.dailyCapacityMinutes),
  );

  return (
    <form action={action} className="mt-4 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-muted-foreground" />

        <p className="text-sm font-medium">Daily capacity override</p>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Leave blank to inherit the organization&apos;s dispatch default.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="block text-xs font-medium">Minutes per day</span>

          <Input
            name="dailyCapacityMinutes"
            type="number"
            min={15}
            max={1440}
            step={15}
            value={dailyCapacityMinutes}
            placeholder="Inherit default"
            disabled={pending}
            onChange={(event) => setDailyCapacityMinutes(event.target.value)}
            className="w-36"
          />
        </label>

        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save capacity"
          )}
        </Button>
      </div>

      {state.error ? <p className="mt-2 text-xs text-red-600">{state.error}</p> : null}

      {state.success ? (
        <p className="mt-2 text-xs text-green-700">Crew capacity saved.</p>
      ) : null}
    </form>
  );
}
