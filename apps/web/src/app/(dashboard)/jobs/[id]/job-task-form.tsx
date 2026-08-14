"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createTaskAction, type CreateTaskState } from "./task-actions";

const initialState: CreateTaskState = {
  error: null,
};

type JobTaskFormProps = {
  jobId: string;
  customerId: string;
};

export function JobTaskForm({ jobId, customerId }: JobTaskFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const action = createTaskAction.bind(null, jobId, customerId);

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
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
    >
      <div>
        <p className="font-medium">Add task</p>

        <p className="mt-1 text-sm text-muted-foreground">
          Add work that needs to be completed for this job.
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
          <Input name="title" placeholder="Install kitchen cabinets" required />
        </div>

        <div className="lg:col-span-2">
          <textarea
            name="description"
            rows={3}
            placeholder="Optional task details..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <select
          name="status"
          defaultValue="TODO"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="TODO">To do</option>

          <option value="IN_PROGRESS">In progress</option>

          <option value="BLOCKED">Blocked</option>

          <option value="COMPLETED">Completed</option>

          <option value="CANCELLED">Cancelled</option>
        </select>

        <select
          name="priority"
          defaultValue="NORMAL"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
        >
          <option value="LOW">Low priority</option>

          <option value="NORMAL">Normal priority</option>

          <option value="HIGH">High priority</option>

          <option value="URGENT">Urgent</option>
        </select>

        <div className="lg:col-span-2">
          <Input name="dueDate" type="date" />
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
      <Plus className="h-4 w-4" />

      {pending ? "Adding task..." : "Add task"}
    </Button>
  );
}
