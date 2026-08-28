"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobSchedule } from "@/lib/job-schedules-api";

import {
  type CalendarScheduleActionState,
  updateCalendarScheduleAction,
} from "./calendar-schedule-actions";

const initialState: CalendarScheduleActionState = {
  success: false,
  message: null,
};

export function CalendarScheduleEditForm({
  schedule,
  onCancel,
  onSaved,
}: {
  schedule: JobSchedule;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();

  const action = updateCalendarScheduleAction.bind(
    null,
    schedule.jobId,
    schedule.job.customer.id,
    schedule.id,
  );

  const [state, formAction, pending] = useActionState(action, initialState);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!state.message) return;

    messageRef.current?.focus();

    if (state.success) {
      router.refresh();
      onSaved();
    }
  }, [onSaved, router, state]);

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          ref={messageRef}
          tabIndex={-1}
          role={state.success ? "status" : "alert"}
          className={`rounded-xl border p-3 text-sm outline-none ${
            state.success
              ? "border-green-500/30 bg-green-500/10 text-green-700"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-start gap-2">
            {state.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            <span>{state.message}</span>
          </div>
        </div>
      ) : null}

      <Field label="Title">
        <Input name="title" defaultValue={schedule.title} disabled={pending} required />
      </Field>

      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          defaultValue={schedule.description ?? ""}
          disabled={pending}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select
            name="type"
            defaultValue={schedule.type}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:opacity-50"
          >
            <option value="WORK">Work</option>
            <option value="SITE_VISIT">Site visit</option>
            <option value="ESTIMATE">Estimate</option>
            <option value="INSPECTION">Inspection</option>
            <option value="DELIVERY">Delivery</option>
            <option value="MEETING">Meeting</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>

        <Field label="Status">
          <select
            name="status"
            defaultValue={schedule.status}
            disabled={pending}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none disabled:opacity-50"
          >
            <option value="SCHEDULED">Scheduled</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </Field>

        <Field label="Start">
          <Input
            name="startAt"
            type="datetime-local"
            defaultValue={formatDateTimeInput(schedule.startAt)}
            disabled={pending}
            required
          />
        </Field>

        <Field label="End">
          <Input
            name="endAt"
            type="datetime-local"
            defaultValue={formatDateTimeInput(schedule.endAt)}
            disabled={pending}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          name="allDay"
          type="checkbox"
          defaultChecked={schedule.allDay}
          disabled={pending}
          className="h-4 w-4 rounded border-input"
        />
        All-day event
      </label>

      <Field label="Location">
        <Input
          name="location"
          defaultValue={schedule.location ?? ""}
          disabled={pending}
          placeholder="Location"
        />
      </Field>

      <Field label="Internal notes">
        <textarea
          name="notes"
          rows={4}
          defaultValue={schedule.notes ?? ""}
          disabled={pending}
          placeholder="Internal notes..."
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </Field>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
          Back
        </Button>

        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save schedule"
          )}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function formatDateTimeInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}
