"use server";

import { revalidatePath } from "next/cache";

import {
  cancelJobSchedule,
  restoreJobSchedule,
  updateJobSchedule,
  type JobScheduleStatus,
  type JobScheduleType,
} from "@/lib/job-schedules-api";
import { ApiRequestError } from "@/lib/server-api";

export type CalendarScheduleActionState = {
  success: boolean;
  message: string | null;
};

export async function updateCalendarScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
  _previousState: CalendarScheduleActionState,
  formData: FormData,
): Promise<CalendarScheduleActionState> {
  const title = getValue(formData, "title");
  const startAt = getValue(formData, "startAt");
  const endAt = getOptionalValue(formData, "endAt");
  const allDay = formData.get("allDay") === "on";

  if (!title) return { success: false, message: "Schedule title is required." };
  if (!startAt) {
    return { success: false, message: "Start date and time are required." };
  }

  let normalizedStartAt: string;
  let normalizedEndAt: string | null;

  try {
    normalizedStartAt = normalizeDateTime(startAt);
    normalizedEndAt = endAt ? normalizeDateTime(endAt) : null;
  } catch {
    return { success: false, message: "Enter valid schedule dates and times." };
  }

  if (
    normalizedEndAt &&
    new Date(normalizedEndAt).getTime() < new Date(normalizedStartAt).getTime()
  ) {
    return {
      success: false,
      message: "End date and time cannot be before the start.",
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
    return handleApiError(error, "Unable to update this schedule event.");
  }

  revalidateSchedulePaths(jobId, customerId);

  return { success: true, message: "Schedule event saved." };
}

export async function cancelCalendarScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
): Promise<CalendarScheduleActionState> {
  try {
    await cancelJobSchedule(jobId, scheduleId);
  } catch (error) {
    return handleApiError(error, "Unable to cancel this schedule event.");
  }

  revalidateSchedulePaths(jobId, customerId);
  return { success: true, message: "Schedule event cancelled." };
}

export async function restoreCalendarScheduleAction(
  jobId: string,
  customerId: string,
  scheduleId: string,
): Promise<CalendarScheduleActionState> {
  try {
    await restoreJobSchedule(jobId, scheduleId);
  } catch (error) {
    return handleApiError(error, "Unable to restore this schedule event.");
  }

  revalidateSchedulePaths(jobId, customerId);
  return { success: true, message: "Schedule event restored." };
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
  if (Number.isNaN(date.getTime())) throw new Error("Invalid schedule date");
  return date.toISOString();
}

function handleApiError(error: unknown, fallback: string): CalendarScheduleActionState {
  if (error instanceof ApiRequestError) {
    console.error("Calendar schedule API error:", error.responseBody);
    return {
      success: false,
      message: getApiErrorMessage(error.responseBody, fallback),
    };
  }

  console.error("Calendar schedule action failed:", error);
  return { success: false, message: fallback };
}

function getApiErrorMessage(responseBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(responseBody) as { message?: unknown };

    if (typeof parsed.message === "string") return parsed.message;

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (message): message is string => typeof message === "string",
      );
      if (messages.length > 0) return messages.join(" ");
    }
  } catch {}

  return fallback;
}
