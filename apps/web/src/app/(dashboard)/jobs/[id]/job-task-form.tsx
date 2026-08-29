"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { generateJobTaskSuggestion, type JobTaskSuggestion } from "./job-ai-actions";
import { createTaskAction, type CreateTaskState } from "./task-actions";

const initialState: CreateTaskState = {
  error: null,
};

type JobTaskFormProps = {
  jobId: string;
  customerId: string;
};

export function JobTaskForm({ jobId, customerId }: JobTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">(
    "NORMAL",
  );
  const [dueDate, setDueDate] = useState("");

  const [aiReason, setAiReason] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [aiPending, startAiTransition] = useTransition();

  async function action(previousState: CreateTaskState, formData: FormData) {
    const result = await createTaskAction(jobId, customerId, previousState, formData);

    if (!result.error) {
      setTitle("");
      setDescription("");
      setStatus("TODO");
      setPriority("NORMAL");
      setDueDate("");
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
      const result = await generateJobTaskSuggestion(jobId);

      if (!result.suggestion) {
        setAiError(result.error || "ContractFlow AI could not suggest a task.");
        return;
      }

      applySuggestion(result.suggestion);
    });
  }

  function applySuggestion(suggestion: JobTaskSuggestion) {
    setTitle(suggestion.title);
    setDescription(suggestion.description);
    setStatus("TODO");
    setPriority(suggestion.priority);
    setDueDate(suggestion.dueDate);
    setAiReason(suggestion.reason);
  }

  const hasAiSuggestion = aiReason !== null;

  const submitDisabled = pending || aiPending || !title.trim();

  return (
    <form action={formAction} className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="font-medium">Add task</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add work that needs to be completed for this job.
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
            placeholder="Install kitchen cabinets"
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
            placeholder="Optional task details..."
            value={description}
            disabled={pending}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <select
          name="status"
          value={status}
          disabled={pending}
          onChange={(event) => setStatus(event.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="TODO">To do</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="BLOCKED">Blocked</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          name="priority"
          value={priority}
          disabled={pending}
          onChange={(event) =>
            setPriority(event.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT")
          }
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="LOW">Low priority</option>
          <option value="NORMAL">Normal priority</option>
          <option value="HIGH">High priority</option>
          <option value="URGENT">Urgent</option>
        </select>

        <div className="lg:col-span-2">
          <Input
            name="dueDate"
            type="date"
            value={dueDate}
            disabled={pending}
            onChange={(event) => setDueDate(event.target.value)}
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
            Review or edit everything before creating the task. AI has not created or
            completed anything yet.
          </p>
        </div>
      )}

      <Button type="submit" disabled={submitDisabled}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}

        {pending ? "Adding task..." : "Add task"}
      </Button>
    </form>
  );
}
