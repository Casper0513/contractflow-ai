"use client";

import { useActionState, useState, useTransition } from "react";
import { CalendarPlus, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  generateJobScheduleSuggestion,
  type JobScheduleSuggestion,
} from "./job-ai-actions";
import { createScheduleAction, type ScheduleFormState } from "./schedule-actions";

const initialState: ScheduleFormState = {
  error: null,
};

type ScheduleType =
  "WORK" | "SITE_VISIT" | "ESTIMATE" | "INSPECTION" | "DELIVERY" | "MEETING" | "OTHER";

type JobScheduleFormProps = {
  jobId: string;
  customerId: string;
};

export function JobScheduleForm({ jobId, customerId }: JobScheduleFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [type, setType] = useState<ScheduleType>("WORK");

  const [location, setLocation] = useState("");

  const [startAt, setStartAt] = useState("");

  const [endAt, setEndAt] = useState("");

  const [allDay, setAllDay] = useState(false);

  const [notes, setNotes] = useState("");

  const [aiReason, setAiReason] = useState<string | null>(null);

  const [aiError, setAiError] = useState<string | null>(null);

  const [aiPending, startAiTransition] = useTransition();

  async function action(previousState: ScheduleFormState, formData: FormData) {
    const result = await createScheduleAction(jobId, customerId, previousState, formData);

    if (!result.error) {
      setTitle("");
      setDescription("");
      setType("WORK");
      setLocation("");
      setStartAt("");
      setEndAt("");
      setAllDay(false);
      setNotes("");
      setAiReason(null);
      setAiError(null);
    }

    return result;
  }

  const [state, formAction, pending] = useActionState(action, initialState);

  function suggestWithAi() {
    if (aiPending || pending) {
      return;
    }

    setAiError(null);

    startAiTransition(async () => {
      const result = await generateJobScheduleSuggestion(jobId);

      if (!result.suggestion) {
        setAiError(result.error || "ContractFlow AI could not suggest a schedule.");
        return;
      }

      applySuggestion(result.suggestion);
    });
  }

  function applySuggestion(suggestion: JobScheduleSuggestion) {
    setTitle(suggestion.title);
    setDescription(suggestion.description);
    setType(suggestion.type);
    setLocation(suggestion.location);
    setStartAt(toDateTimeLocal(suggestion.startAt));
    setEndAt(toDateTimeLocal(suggestion.endAt));
    setAllDay(suggestion.allDay);
    setNotes(suggestion.notes);
    setAiReason(suggestion.reason);
  }

  const hasAiSuggestion = aiReason !== null;

  const submitDisabled = pending || aiPending || !title.trim() || !startAt;

  return (
    <form action={formAction} className="space-y-5 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-medium">Add schedule event</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Schedule work, visits, inspections, deliveries, meetings, and other events.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={aiPending || pending}
          onClick={suggestWithAi}
        >
          {aiPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}

          {aiPending
            ? "Thinking..."
            : hasAiSuggestion
              ? "Regenerate with AI"
              : "Suggest with AI"}
        </Button>
      </div>

      {aiError && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {aiError}
        </div>
      )}

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
          <Input
            name="title"
            placeholder="Kitchen demolition"
            required
            value={title}
            disabled={pending}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="lg:col-span-2">
          <textarea
            name="description"
            rows={3}
            placeholder="Optional event description..."
            value={description}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <select
          name="type"
          value={type}
          disabled={pending}
          onChange={(event) => setType(event.target.value as ScheduleType)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="WORK">Work</option>

          <option value="SITE_VISIT">Site visit</option>

          <option value="ESTIMATE">Estimate</option>

          <option value="INSPECTION">Inspection</option>

          <option value="DELIVERY">Delivery</option>

          <option value="MEETING">Meeting</option>

          <option value="OTHER">Other</option>
        </select>

        <Input
          name="location"
          placeholder="Location"
          value={location}
          disabled={pending}
          onChange={(event) => setLocation(event.target.value)}
        />

        <Input
          name="startAt"
          type="datetime-local"
          required
          value={startAt}
          disabled={pending}
          onChange={(event) => setStartAt(event.target.value)}
        />

        <Input
          name="endAt"
          type="datetime-local"
          value={endAt}
          disabled={pending}
          onChange={(event) => setEndAt(event.target.value)}
        />

        <div className="lg:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              name="allDay"
              type="checkbox"
              checked={allDay}
              disabled={pending}
              onChange={(event) => setAllDay(event.target.checked)}
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
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      {aiReason && (
        <div className="rounded-lg border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Why ContractFlow AI suggested this
          </div>

          <p className="mt-2 text-sm text-muted-foreground">{aiReason}</p>

          <p className="mt-2 text-xs text-muted-foreground">
            Review or edit everything before creating the event. AI has not scheduled,
            dispatched, or assigned anything yet.
          </p>
        </div>
      )}

      <Button type="submit" disabled={submitDisabled}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CalendarPlus className="h-4 w-4" />
        )}

        {pending ? "Scheduling..." : "Add event"}
      </Button>
    </form>
  );
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}
