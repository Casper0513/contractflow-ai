"use server";

import { revalidatePath } from "next/cache";

import { type JobScheduleType, updateDispatchSettings } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export type DispatchSettingsActionState = {
  success: boolean;
  message: string | null;
};

const SCHEDULE_TYPES: JobScheduleType[] = [
  "WORK",
  "SITE_VISIT",
  "ESTIMATE",
  "INSPECTION",
  "DELIVERY",
  "MEETING",
  "OTHER",
];

export async function updateDispatchSettingsAction(
  _previousState: DispatchSettingsActionState,
  formData: FormData,
): Promise<DispatchSettingsActionState> {
  const startTime = formData.get("defaultStartTime");
  const duration = getInteger(formData, "defaultDurationMinutes");
  const scheduleType = formData.get("defaultScheduleType");

  if (typeof startTime !== "string") {
    return {
      success: false,
      message: "Choose a valid default start time.",
    };
  }

  const parsedTime = parseTime(startTime);

  if (!parsedTime) {
    return {
      success: false,
      message: "Choose a valid default start time.",
    };
  }

  if (duration === null || duration < 15 || duration > 1440) {
    return {
      success: false,
      message: "Default duration must be between 15 and 1440 minutes.",
    };
  }

  if (
    typeof scheduleType !== "string" ||
    !SCHEDULE_TYPES.includes(scheduleType as JobScheduleType)
  ) {
    return {
      success: false,
      message: "Choose a valid default schedule type.",
    };
  }

  try {
    await updateDispatchSettings({
      defaultStartHour: parsedTime.hour,
      defaultStartMinute: parsedTime.minute,
      defaultDurationMinutes: duration,
      defaultScheduleType: scheduleType as JobScheduleType,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Dispatch settings API error:", error.responseBody);

      return {
        success: false,
        message: getApiErrorMessage(
          error.responseBody,
          "Unable to save dispatch settings.",
        ),
      };
    }

    console.error("Dispatch settings update failed:", error);

    return {
      success: false,
      message: "Unable to save dispatch settings. Please try again.",
    };
  }

  revalidatePath("/settings");
  revalidatePath("/calendar");

  return {
    success: true,
    message: "Dispatch scheduling defaults saved.",
  };
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return {
    hour,
    minute,
  };
}

function getInteger(formData: FormData, key: string): number | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const number = Number(value);

  if (!Number.isInteger(number)) {
    return null;
  }

  return number;
}

function getApiErrorMessage(responseBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: unknown;
    };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (message): message is string => typeof message === "string",
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch {
    // Response was not JSON.
  }

  return fallback;
}
