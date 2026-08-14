"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobSchedule } from "@/lib/job-schedules-api";

import { type ScheduleFormState, updateScheduleAction } from "./schedule-actions";

const initialState: ScheduleFormState = {
  error: null,
};

type JobScheduleEditFormProps = {
  jobId: string;
  customerId: string;
  schedule: JobSchedule;
  onClose: () => void;
};

export function JobScheduleEditForm({
  jobId,
  customerId,
  schedule,
  onClose,
}: JobScheduleEditFormProps) {
  const action = updateScheduleAction.bind(null, jobId, customerId, schedule.id);

  const [state, formAction] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-4 rounded-xl border bg-muted/20 p-4"
    >
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <Input name="title" defaultValue={schedule.title} required />

      <textarea
        name="description"
        rows={3}
        defaultValue={schedule.description ?? ""}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <select
          name="type"
          defaultValue={schedule.type}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="WORK">Work</option>

          <option value="SITE_VISIT">Site visit</option>

          <option value="ESTIMATE">Estimate</option>

          <option value="INSPECTION">Inspection</option>

          <option value="DELIVERY">Delivery</option>

          <option value="MEETING">Meeting</option>

          <option value="OTHER">Other</option>
        </select>

        <select
          name="status"
          defaultValue={schedule.status}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="SCHEDULED">Scheduled</option>

          <option value="IN_PROGRESS">In progress</option>

          <option value="COMPLETED">Completed</option>

          <option value="CANCELLED">Cancelled</option>
        </select>

        <Input
          name="startAt"
          type="datetime-local"
          defaultValue={formatDateTimeInput(schedule.startAt)}
          required
        />

        <Input
          name="endAt"
          type="datetime-local"
          defaultValue={formatDateTimeInput(schedule.endAt)}
        />

        <div className="sm:col-span-2">
          <Input
            name="location"
            defaultValue={schedule.location ?? ""}
            placeholder="Location"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              name="allDay"
              type="checkbox"
              defaultChecked={schedule.allDay}
              className="h-4 w-4 rounded border-input"
            />
            All-day event
          </label>
        </div>

        <div className="sm:col-span-2">
          <textarea
            name="notes"
            rows={3}
            defaultValue={schedule.notes ?? ""}
            placeholder="Internal notes..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SubmitButton />

        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save event"}
    </Button>
  );
}

function formatDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  const offset = date.getTimezoneOffset();

  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}
