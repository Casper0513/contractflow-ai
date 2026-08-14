import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobTaskStatus =
  "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";

export type JobTaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type JobTaskCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobTask = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  title: string;
  description: string | null;

  status: JobTaskStatus;
  priority: JobTaskPriority;

  dueDate: string | null;
  completedAt: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: JobTaskCreatedBy | null;
};

export type CreateJobTaskInput = {
  title: string;
  description?: string;
  status?: JobTaskStatus;
  priority?: JobTaskPriority;
  dueDate?: string;
};

export type UpdateJobTaskInput = Partial<CreateJobTaskInput>;

export function getJobTasks(jobId: string): Promise<JobTask[]> {
  return authenticatedApiRequest<JobTask[]>(`/jobs/${jobId}/tasks`);
}

export function createJobTask(
  jobId: string,
  input: CreateJobTaskInput,
): Promise<JobTask> {
  return authenticatedApiRequest<JobTask>(`/jobs/${jobId}/tasks`, {
    method: "POST",
    body: input,
  });
}

export function updateJobTask(
  jobId: string,
  taskId: string,
  input: UpdateJobTaskInput,
): Promise<JobTask> {
  return authenticatedApiRequest<JobTask>(`/jobs/${jobId}/tasks/${taskId}`, {
    method: "PATCH",
    body: input,
  });
}

export function completeJobTask(jobId: string, taskId: string): Promise<JobTask> {
  return authenticatedApiRequest<JobTask>(`/jobs/${jobId}/tasks/${taskId}/complete`, {
    method: "PATCH",
  });
}

export function reopenJobTask(jobId: string, taskId: string): Promise<JobTask> {
  return authenticatedApiRequest<JobTask>(`/jobs/${jobId}/tasks/${taskId}/reopen`, {
    method: "PATCH",
  });
}

export function deleteJobTask(
  jobId: string,
  taskId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{
    success: boolean;
  }>(`/jobs/${jobId}/tasks/${taskId}`, {
    method: "DELETE",
  });
}
