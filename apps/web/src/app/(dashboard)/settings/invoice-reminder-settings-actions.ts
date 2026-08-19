"use server";

import { revalidatePath } from "next/cache";

import { updateInvoiceReminderSettings } from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export type InvoiceReminderSettingsActionState = {
  success: boolean;
  message: string | null;
};

export async function updateInvoiceReminderSettingsAction(
  _previousState: InvoiceReminderSettingsActionState,
  formData: FormData,
): Promise<InvoiceReminderSettingsActionState> {
  const beforeDueDays = getInteger(formData, "beforeDueDays");
  const firstOverdueDays = getInteger(formData, "firstOverdueDays");
  const secondOverdueDays = getInteger(formData, "secondOverdueDays");

  if (beforeDueDays === null || beforeDueDays < 1 || beforeDueDays > 365) {
    return {
      success: false,
      message: "Before-due reminder days must be between 1 and 365.",
    };
  }

  if (firstOverdueDays === null || firstOverdueDays < 1 || firstOverdueDays > 365) {
    return {
      success: false,
      message: "First overdue reminder days must be between 1 and 365.",
    };
  }

  if (secondOverdueDays === null || secondOverdueDays < 1 || secondOverdueDays > 365) {
    return {
      success: false,
      message: "Second overdue reminder days must be between 1 and 365.",
    };
  }

  const firstOverdueEnabled = getCheckbox(formData, "firstOverdueEnabled");
  const secondOverdueEnabled = getCheckbox(formData, "secondOverdueEnabled");

  if (
    firstOverdueEnabled &&
    secondOverdueEnabled &&
    secondOverdueDays <= firstOverdueDays
  ) {
    return {
      success: false,
      message: "The second overdue reminder must occur after the first.",
    };
  }

  try {
    await updateInvoiceReminderSettings({
      enabled: getCheckbox(formData, "enabled"),

      beforeDueEnabled: getCheckbox(formData, "beforeDueEnabled"),
      beforeDueDays,

      dueTodayEnabled: getCheckbox(formData, "dueTodayEnabled"),

      firstOverdueEnabled,
      firstOverdueDays,

      secondOverdueEnabled,
      secondOverdueDays,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Invoice reminder settings API error:", error.responseBody);

      return {
        success: false,
        message: getApiErrorMessage(
          error.responseBody,
          "Unable to save invoice reminder settings.",
        ),
      };
    }

    console.error("Invoice reminder settings update failed:", error);

    return {
      success: false,
      message: "Unable to save invoice reminder settings. Please try again.",
    };
  }

  revalidatePath("/settings");

  return {
    success: true,
    message: "Invoice reminder settings saved.",
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
