"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createScheduleAction, type ScheduleFormState } from "./schedule-actions";

const initialState: ScheduleFormState = {
  error: null,
};

type JobScheduleFormProps = {
  jobId: string;
  customerId: string;
};

export function JobScheduleForm({ jobId, customerId }: JobScheduleFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const action = createScheduleAction.bind(null, jobId, customerId);

  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.error) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5 rounded-xl border bg-muted/20 p-4"
    >
      <div>
        <p className="font-medium">Add schedule event</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Schedule work, visits, inspections, deliveries, meetings, and other events.
        </p>
      </div>

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {state.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <Input name="title" placeholder="Kitchen demolition" required />
        </div>

        <div className="lg:col-span-2">
          <textarea
            name="description"
            rows={3}
            placeholder="Optional event description..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <select
          name="type"
          defaultValue="WORK"
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

        <Input name="location" placeholder="Location" />

        <Input name="startAt" type="datetime-local" required />

        <Input name="endAt" type="datetime-local" />

        <div className="lg:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              name="allDay"
              type="checkbox"
              className="h-4 w-4 rounded border-input"
            />
            All-day event
          </label>
        </div>

        <div className="lg:col-span-2">
          <textarea
            name="notes"
            rows={3}
            placeholder="Internal notes..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <CalendarPlus className="h-4 w-4" />

      {pending ? "Scheduling..." : "Add event"}
    </Button>
  );
}
