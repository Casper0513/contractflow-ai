"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Gauge,
  Loader2,
  LockKeyhole,
  TimerReset,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DispatchSettings, JobScheduleType } from "@/lib/organizations-api";

import {
  type DispatchSettingsActionState,
  updateDispatchSettingsAction,
} from "./dispatch-settings-actions";

const initialState: DispatchSettingsActionState = {
  success: false,
  message: null,
};

const SCHEDULE_TYPES: Array<{
  value: JobScheduleType;
  label: string;
}> = [
  { value: "WORK", label: "Work" },
  { value: "SITE_VISIT", label: "Site visit" },
  { value: "ESTIMATE", label: "Estimate" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "MEETING", label: "Meeting" },
  { value: "OTHER", label: "Other" },
];

type DispatchSettingsFormProps = {
  settings: DispatchSettings;
  canEdit: boolean;
};

export function DispatchSettingsForm({ settings, canEdit }: DispatchSettingsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateDispatchSettingsAction,
    initialState,
  );

  const [startTime, setStartTime] = useState(() =>
    formatTime(settings.defaultStartHour, settings.defaultStartMinute),
  );

  const [duration, setDuration] = useState(() => String(settings.defaultDurationMinutes));

  const [crewDailyCapacity, setCrewDailyCapacity] = useState(() =>
    String(settings.defaultCrewDailyCapacityMinutes),
  );

  const [scheduleType, setScheduleType] = useState<JobScheduleType>(
    settings.defaultScheduleType,
  );

  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.message) {
      messageRef.current?.focus();
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {!canEdit ? (
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div>
            <p className="font-medium">Dispatch defaults are read-only</p>

            <p className="mt-1 text-sm text-muted-foreground">
              Only organization owners and administrators can update these settings.
            </p>
          </div>
        </div>
      ) : null}

      {state.message ? (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.success ? "status" : "alert"}
          className={`rounded-xl border p-4 text-sm outline-none ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}

            <span>{state.message}</span>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SettingField
          icon={Clock3}
          title="Default start time"
          description="Time used when a backlog job is dropped onto a crew/date cell."
        >
          <Input
            id="defaultStartTime"
            name="defaultStartTime"
            type="time"
            value={startTime}
            disabled={!canEdit || pending}
            onChange={(event) => setStartTime(event.target.value)}
            className="max-w-xs"
            required
          />
        </SettingField>

        <SettingField
          icon={TimerReset}
          title="Default duration"
          description="Length of a newly dispatched backlog schedule."
        >
          <div className="flex items-center gap-3">
            <Input
              id="defaultDurationMinutes"
              name="defaultDurationMinutes"
              type="number"
              min={15}
              max={1440}
              step={15}
              value={duration}
              disabled={!canEdit || pending}
              onChange={(event) => setDuration(event.target.value)}
              className="w-28"
              required
            />

            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </SettingField>

        <SettingField
          icon={CalendarClock}
          title="Default schedule type"
          description="Schedule type created when dispatching a backlog job."
        >
          <select
            id="defaultScheduleType"
            name="defaultScheduleType"
            value={scheduleType}
            disabled={!canEdit || pending}
            onChange={(event) => setScheduleType(event.target.value as JobScheduleType)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {SCHEDULE_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </SettingField>

        <SettingField
          icon={Gauge}
          title="Default crew daily capacity"
          description="Daily workload threshold used for crew capacity warnings."
        >
          <div className="flex items-center gap-3">
            <Input
              id="defaultCrewDailyCapacityMinutes"
              name="defaultCrewDailyCapacityMinutes"
              type="number"
              min={15}
              max={1440}
              step={15}
              value={crewDailyCapacity}
              disabled={!canEdit || pending}
              onChange={(event) => setCrewDailyCapacity(event.target.value)}
              className="w-28"
              required
            />

            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </SettingField>
      </div>

      <div className="flex gap-3 rounded-xl border bg-muted/20 p-4">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

        <div>
          <p className="text-sm font-medium">Backlog drag defaults</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Dispatch timing values are used automatically when a backlog job is dropped
            onto the Week or Day board. Crew capacity is a warning threshold only and does
            not block valid non-overlapping work.
          </p>
        </div>
      </div>

      {canEdit ? (
        <div className="flex justify-end border-t pt-6">
          <Button type="submit" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save dispatch defaults"
            )}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function SettingField({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Clock3;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg border bg-muted/30 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div>
          <p className="font-medium">{title}</p>

          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
