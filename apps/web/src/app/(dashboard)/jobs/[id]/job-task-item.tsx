"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleAlert,
  CirclePause,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobTask, JobTaskPriority, JobTaskStatus } from "@/lib/job-tasks-api";

import { JobTaskEditForm } from "./job-task-edit-form";
import {
  completeTaskAction,
  deleteTaskAction,
  reopenTaskAction,
  updateTaskStatusAction,
} from "./task-actions";

type JobTaskItemProps = {
  jobId: string;
  customerId: string;
  task: JobTask;
};

export function JobTaskItem({ jobId, customerId, task }: JobTaskItemProps) {
  const [editing, setEditing] = useState(false);

  const [pending, startTransition] = useTransition();

  const completed = task.status === "COMPLETED";

  const overdue = isOverdue(task);

  function changeStatus(status: JobTaskStatus) {
    if (pending || status === task.status) {
      return;
    }

    startTransition(async () => {
      await updateTaskStatusAction(jobId, customerId, task.id, status);
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 ${
        completed
          ? "bg-muted/20"
          : overdue
            ? "border-red-500/30 bg-red-500/5"
            : "bg-background"
      }`}
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusIcon status={task.status} />

            <p
              className={`font-medium ${
                completed ? "text-muted-foreground line-through" : ""
              }`}
            >
              {task.title}
            </p>

            <TaskStatusBadge status={task.status} />

            <TaskPriorityBadge priority={task.priority} />

            {overdue && (
              <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600">
                Overdue
              </span>
            )}
          </div>

          {task.description && (
            <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>
          )}

          {task.dueDate && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4" />

              <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {!completed && (
            <select
              value={task.status}
              disabled={pending}
              onChange={(event) => changeStatus(event.target.value as JobTaskStatus)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="TODO">To do</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          )}

          {completed ? (
            <form action={reopenTaskAction.bind(null, jobId, customerId, task.id)}>
              <Button type="submit" size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Reopen
              </Button>
            </form>
          ) : (
            <form action={completeTaskAction.bind(null, jobId, customerId, task.id)}>
              <Button type="submit" size="sm">
                <CheckCircle2 className="h-4 w-4" />
                Complete
              </Button>
            </form>
          )}

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing((current) => !current)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          <form action={deleteTaskAction.bind(null, jobId, customerId, task.id)}>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              aria-label={`Delete ${task.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {editing && (
        <JobTaskEditForm
          jobId={jobId}
          customerId={customerId}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function isOverdue(task: JobTask) {
  if (!task.dueDate || task.status === "COMPLETED" || task.status === "CANCELLED") {
    return false;
  }

  const dueDate = new Date(task.dueDate);
  const today = new Date();

  dueDate.setHours(23, 59, 59, 999);

  return dueDate.getTime() < today.getTime();
}

function StatusIcon({ status }: { status: JobTaskStatus }) {
  switch (status) {
    case "COMPLETED":
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;

    case "BLOCKED":
      return <CircleAlert className="h-5 w-5 text-red-600" />;

    case "IN_PROGRESS":
      return <CirclePause className="h-5 w-5 text-blue-600" />;

    case "CANCELLED":
      return <CircleAlert className="h-5 w-5 text-muted-foreground" />;

    default:
      return <Circle className="h-5 w-5 text-muted-foreground" />;
  }
}

function TaskStatusBadge({ status }: { status: JobTaskStatus }) {
  const styles: Record<JobTaskStatus, string> = {
    TODO: "border-slate-500/30 bg-slate-500/10 text-slate-600",
    IN_PROGRESS: "border-blue-500/30 bg-blue-500/10 text-blue-600",
    BLOCKED: "border-red-500/30 bg-red-500/10 text-red-600",
    COMPLETED: "border-green-500/30 bg-green-500/10 text-green-700",
    CANCELLED: "border-muted bg-muted text-muted-foreground",
  };

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {formatEnumLabel(status)}
    </span>
  );
}

function TaskPriorityBadge({ priority }: { priority: JobTaskPriority }) {
  const styles: Record<JobTaskPriority, string> = {
    LOW: "text-muted-foreground",
    NORMAL: "text-blue-600",
    HIGH: "text-orange-600",
    URGENT: "text-red-600",
  };

  return (
    <span className={`text-xs font-medium ${styles[priority]}`}>
      {formatEnumLabel(priority)}
    </span>
  );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
