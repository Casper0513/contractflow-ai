"use server";

import { revalidatePath } from "next/cache";

import { getApiErrorMessage } from "@/lib/api-error-message";
import { updateEstimateReminderSettings } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export type EstimateReminderSettingsActionState = {
  success: boolean;
  message: string | null;
};

export async function updateEstimateReminderSettingsAction(
  _previousState: EstimateReminderSettingsActionState,
  formData: FormData,
): Promise<EstimateReminderSettingsActionState> {
  const firstFollowUpDays = getInteger(formData, "firstFollowUpDays");
  const secondFollowUpDays = getInteger(formData, "secondFollowUpDays");

  if (firstFollowUpDays === null || firstFollowUpDays < 1 || firstFollowUpDays > 365) {
    return {
      success: false,
      message: "First follow-up days must be between 1 and 365.",
    };
  }

  if (secondFollowUpDays === null || secondFollowUpDays < 1 || secondFollowUpDays > 365) {
    return {
      success: false,
      message: "Second follow-up days must be between 1 and 365.",
    };
  }

  const firstFollowUpEnabled = getCheckbox(formData, "firstFollowUpEnabled");

  const secondFollowUpEnabled = getCheckbox(formData, "secondFollowUpEnabled");

  if (
    firstFollowUpEnabled &&
    secondFollowUpEnabled &&
    secondFollowUpDays <= firstFollowUpDays
  ) {
    return {
      success: false,
      message: "The second follow-up must occur after the first.",
    };
  }

  try {
    await updateEstimateReminderSettings({
      enabled: getCheckbox(formData, "enabled"),

      firstFollowUpEnabled,
      firstFollowUpDays,

      secondFollowUpEnabled,
      secondFollowUpDays,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Estimate reminder settings API error status:", error.status);

      return {
        success: false,
        message: getApiErrorMessage(
          error.responseBody,
          error.status,
          "Unable to save estimate reminder settings.",
        ),
      };
    }

    console.error("Estimate reminder settings update failed:");

    return {
      success: false,
      message: "Unable to save estimate reminder settings. Please try again.",
    };
  }

  revalidatePath("/settings");

  return {
    success: true,
    message: "Estimate reminder settings saved.",
  };
}

function getCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
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
