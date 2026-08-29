"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { JobTask } from "@/lib/job-tasks-api";

import { type EditTaskState, updateTaskAction } from "./task-actions";

const initialState: EditTaskState = {
  error: null,
};

type JobTaskEditFormProps = {
  jobId: string;
  customerId: string;
  task: JobTask;
  onClose: () => void;
};

export function JobTaskEditForm({
  jobId,
  customerId,
  task,
  onClose,
}: JobTaskEditFormProps) {
  const [title, setTitle] = useState(task.title);

  const [description, setDescription] = useState(task.description ?? "");

  const [priority, setPriority] = useState(task.priority);

  const [dueDate, setDueDate] = useState(formatDateInput(task.dueDate));

  const action = updateTaskAction.bind(null, jobId, customerId, task.id);

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

      <Input
        name="title"
        value={title}
        required
        onChange={(event) => setTitle(event.target.value)}
      />

      <textarea
        name="description"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Task details..."
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <select
          name="priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as JobTask["priority"])}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="LOW">Low</option>

          <option value="NORMAL">Normal</option>

          <option value="HIGH">High</option>

          <option value="URGENT">Urgent</option>
        </select>

        <Input
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
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
      {pending ? "Saving..." : "Save task"}
    </Button>
  );
}

function formatDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}
