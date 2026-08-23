import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JobTask } from "@/lib/job-tasks-api";

import { JobTaskForm } from "./job-task-form";
import { JobTaskList } from "./job-task-list";

type JobTasksSectionProps = {
  jobId: string;
  customerId: string;
  archived: boolean;
  tasks: JobTask[];
};

export function JobTasksSection({
  jobId,
  customerId,
  archived,
  tasks,
}: JobTasksSectionProps) {
  const completedTasks = tasks.filter((task) => task.status === "COMPLETED").length;

  const taskProgress =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <CardTitle>Tasks</CardTitle>

            <CardDescription className="mt-1">
              Track the work required to complete this job.
            </CardDescription>
          </div>

          <div className="text-sm text-muted-foreground">
            {completedTasks} of {tasks.length} complete
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>

            <span className="font-medium">{taskProgress}%</span>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${taskProgress}%`,
              }}
            />
          </div>
        </div>

        {!archived && <JobTaskForm jobId={jobId} customerId={customerId} />}

        <JobTaskList jobId={jobId} customerId={customerId} tasks={tasks} />
      </CardContent>
    </Card>
  );
}
