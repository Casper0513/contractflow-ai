"use client";

import { useMemo, useState } from "react";
import { Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobTask } from "@/lib/job-tasks-api";

import { JobTaskItem } from "./job-task-item";

type JobTaskListProps = {
  jobId: string;
  customerId: string;
  tasks: JobTask[];
};

type Filter = "OPEN" | "COMPLETED" | "ALL";

export function JobTaskList({ jobId, customerId, tasks }: JobTaskListProps) {
  const [filter, setFilter] = useState<Filter>("OPEN");

  const filteredTasks = useMemo(() => {
    if (filter === "ALL") {
      return tasks;
    }

    if (filter === "COMPLETED") {
      return tasks.filter((task) => task.status === "COMPLETED");
    }

    return tasks.filter(
      (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
    );
  }, [filter, tasks]);

  if (tasks.length === 0) {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed">
        <div className="max-w-sm px-6 text-center">
          <Circle className="mx-auto h-8 w-8 text-muted-foreground" />

          <p className="mt-3 font-medium">No tasks yet</p>

          <p className="mt-1 text-sm text-muted-foreground">
            Add the first task for this job.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterButton active={filter === "OPEN"} onClick={() => setFilter("OPEN")}>
          Open
        </FilterButton>

        <FilterButton
          active={filter === "COMPLETED"}
          onClick={() => setFilter("COMPLETED")}
        >
          Completed
        </FilterButton>

        <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All
        </FilterButton>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tasks match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <JobTaskItem
              key={task.id}
              jobId={jobId}
              customerId={customerId}
              task={task}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
