"use server";

import { revalidatePath } from "next/cache";

import {
  completeJobTask,
  createJobTask,
  deleteJobTask,
  reopenJobTask,
  updateJobTask,
  type JobTaskPriority,
  type JobTaskStatus,
} from "@/lib/job-tasks-api";

export type CreateTaskState = {
  error: string | null;
};

export type EditTaskState = {
  error: string | null;
};

export async function createTaskAction(
  jobId: string,
  customerId: string,
  _previousState: CreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const title = getValue(formData, "title");

  if (!title) {
    return {
      error: "Task title is required.",
    };
  }

  try {
    await createJobTask(jobId, {
      title,
      description: getOptionalValue(formData, "description"),
      status: getTaskStatus(formData.get("status")),
      priority: getTaskPriority(formData.get("priority")),
      dueDate: getOptionalValue(formData, "dueDate"),
    });
  } catch (error) {
    console.error("Create task failed:", error);

    return {
      error: "Unable to create this task. Please try again.",
    };
  }

  revalidateJobPaths(jobId, customerId);

  return {
    error: null,
  };
}

export async function updateTaskAction(
  jobId: string,
  customerId: string,
  taskId: string,
  _previousState: EditTaskState,
  formData: FormData,
): Promise<EditTaskState> {
  const title = getValue(formData, "title");

  if (!title) {
    return {
      error: "Task title is required.",
    };
  }

  try {
    await updateJobTask(jobId, taskId, {
      title,
      description: getOptionalValue(formData, "description"),
      priority: getTaskPriority(formData.get("priority")),
      dueDate: getOptionalValue(formData, "dueDate"),
    });
  } catch (error) {
    console.error("Update task failed:", error);

    return {
      error: "Unable to update this task. Please try again.",
    };
  }

  revalidateJobPaths(jobId, customerId);

  return {
    error: null,
  };
}

export async function updateTaskStatusAction(
  jobId: string,
  customerId: string,
  taskId: string,
  status: JobTaskStatus,
) {
  await updateJobTask(jobId, taskId, {
    status,
  });

  revalidateJobPaths(jobId, customerId);
}

export async function completeTaskAction(
  jobId: string,
  customerId: string,
  taskId: string,
) {
  await completeJobTask(jobId, taskId);

  revalidateJobPaths(jobId, customerId);
}

export async function reopenTaskAction(
  jobId: string,
  customerId: string,
  taskId: string,
) {
  await reopenJobTask(jobId, taskId);

  revalidateJobPaths(jobId, customerId);
}

export async function deleteTaskAction(
  jobId: string,
  customerId: string,
  taskId: string,
) {
  await deleteJobTask(jobId, taskId);

  revalidateJobPaths(jobId, customerId);
}

function revalidateJobPaths(jobId: string, customerId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
}

function getTaskStatus(value: FormDataEntryValue | null): JobTaskStatus {
  const statuses: JobTaskStatus[] = [
    "TODO",
    "IN_PROGRESS",
    "BLOCKED",
    "COMPLETED",
    "CANCELLED",
  ];

  return statuses.includes(value as JobTaskStatus) ? (value as JobTaskStatus) : "TODO";
}

function getTaskPriority(value: FormDataEntryValue | null): JobTaskPriority {
  const priorities: JobTaskPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

  return priorities.includes(value as JobTaskPriority)
    ? (value as JobTaskPriority)
    : "NORMAL";
}
