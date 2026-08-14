"use server";

import { revalidatePath } from "next/cache";

import {
  cancelJobSchedule,
  createJobSchedule,
  restoreJobSchedule,
  updateJobSchedule,
  type JobScheduleStatus,
  type JobScheduleType,
} from "@/lib/job-schedules-api";

export type ScheduleFormState = {
  error: string | null;
};

export async function createScheduleAction(
  jobId: string,
  customerId: string,
  _previousState: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const title = getValue(formData, "title");
  const startAt = getValue(formData, "startAt");
  const endAt = getOptionalValue(formData, "endAt");
  const allDay = formData.get("allDay") === "on";

  if (!title) {
    return {
      error: "Schedule title is required.",
    };
  }

  if (!startAt) {
    return {
      error: "Start date and time are required.",
    };
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = endAt ? normalizeDateTime(endAt) : undefined;

  if (
    normalizedEndAt &&
    new Date(normalizedEndAt).getTime() < new Date(normalizedStartAt).getTime()
  ) {
    return {
      error: "End date and time cannot be before the start.",
    };
  }

  try {
    await createJobSchedule(jobId, {
      title,
      description: getOptionalValue(formData, "description"),
      type: getScheduleType(formData.get("type")),
      status: "SCHEDULED",
      startAt: normalizedStartAt,
      endAt: normalizedEndAt,
      allDay,
      location: getOptionalValue(formData, "location"),
      notes: getOptionalValue(formData, "notes"),
    });
  } catch (error) {
    console.error("Create schedule failed:", error);

    return {
      error: "Unable to create this schedule event. Please try again.",
    };
  }

  revalidateSchedulePaths(jobId, customerId);

  return {
    error: null,
  };
}

export async function updateScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
  _previousState: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const title = getValue(formData, "title");
  const startAt = getValue(formData, "startAt");
  const endAt = getOptionalValue(formData, "endAt");
  const allDay = formData.get("allDay") === "on";

  if (!title) {
    return {
      error: "Schedule title is required.",
    };
  }

  if (!startAt) {
    return {
      error: "Start date and time are required.",
    };
  }

  const normalizedStartAt = normalizeDateTime(startAt);
  const normalizedEndAt = endAt ? normalizeDateTime(endAt) : null;

  if (
    normalizedEndAt &&
    new Date(normalizedEndAt).getTime() < new Date(normalizedStartAt).getTime()
  ) {
    return {
      error: "End date and time cannot be before the start.",
    };
  }

  try {
    await updateJobSchedule(jobId, scheduleId, {
      title,
      description: getOptionalValue(formData, "description"),
      type: getScheduleType(formData.get("type")),
      status: getScheduleStatus(formData.get("status")),
      startAt: normalizedStartAt,
      endAt: normalizedEndAt,
      allDay,
      location: getOptionalValue(formData, "location"),
      notes: getOptionalValue(formData, "notes"),
    });
  } catch (error) {
    console.error("Update schedule failed:", error);

    return {
      error: "Unable to update this schedule event. Please try again.",
    };
  }

  revalidateSchedulePaths(jobId, customerId);

  return {
    error: null,
  };
}

export async function updateScheduleStatusAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
  status: JobScheduleStatus,
) {
  await updateJobSchedule(jobId, scheduleId, {
    status,
  });

  revalidateSchedulePaths(jobId, customerId);
}

export async function cancelScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
) {
  await cancelJobSchedule(jobId, scheduleId);

  revalidateSchedulePaths(jobId, customerId);
}

export async function restoreScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
) {
  await restoreJobSchedule(jobId, scheduleId);

  revalidateSchedulePaths(jobId, customerId);
}

function revalidateSchedulePaths(jobId: string, customerId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");

  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
}

function getScheduleType(value: FormDataEntryValue | null): JobScheduleType {
  const types: JobScheduleType[] = [
    "WORK",
    "SITE_VISIT",
    "ESTIMATE",
    "INSPECTION",
    "DELIVERY",
    "MEETING",
    "OTHER",
  ];

  return types.includes(value as JobScheduleType) ? (value as JobScheduleType) : "WORK";
}

function getScheduleStatus(value: FormDataEntryValue | null): JobScheduleStatus {
  const statuses: JobScheduleStatus[] = [
    "SCHEDULED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
  ];

  return statuses.includes(value as JobScheduleStatus)
    ? (value as JobScheduleStatus)
    : "SCHEDULED";
}

function normalizeDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid schedule date");
  }

  return date.toISOString();
}
