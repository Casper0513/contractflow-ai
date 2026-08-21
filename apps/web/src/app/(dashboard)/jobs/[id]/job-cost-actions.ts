"use server";

import { revalidatePath } from "next/cache";

import {
  createJobCost,
  deleteJobCost,
  type JobCostCategory,
  updateJobCost,
} from "@/lib/job-costs-api";
import { ApiRequestError } from "@/lib/server-api";

export type CreateJobCostState = {
  error: string | null;
  success: boolean;
};

export type UpdateJobCostState = {
  error: string | null;
  success: boolean;
};

export type DeleteJobCostState = {
  error: string | null;
  success: boolean;
};

export async function createJobCostAction(
  jobId: string,
  _previousState: CreateJobCostState,
  formData: FormData,
): Promise<CreateJobCostState> {
  try {
    const category = readCategory(formData.get("category"));

    const description = readRequiredString(formData.get("description"), "Description");

    const amountCents = readMoneyAsCents(formData.get("amount"), "Amount");

    const incurredAt = readOptionalDate(formData.get("incurredAt"));

    const vendor = readOptionalString(formData.get("vendor"));

    const reference = readOptionalString(formData.get("reference"));

    const notes = readOptionalString(formData.get("notes"));

    await createJobCost(jobId, {
      category,
      description,
      amountCents,
      ...(incurredAt ? { incurredAt } : {}),
      ...(vendor ? { vendor } : {}),
      ...(reference ? { reference } : {}),
      ...(notes ? { notes } : {}),
    });

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to add job cost."),
      success: false,
    };
  }
}

export async function updateJobCostAction(
  jobId: string,
  costId: string,
  _previousState: UpdateJobCostState,
  formData: FormData,
): Promise<UpdateJobCostState> {
  try {
    const category = readCategory(formData.get("category"));

    const description = readRequiredString(formData.get("description"), "Description");

    const amountCents = readMoneyAsCents(formData.get("amount"), "Amount");

    const incurredAt = readOptionalDate(formData.get("incurredAt"));

    const vendor = readNullableString(formData.get("vendor"));

    const reference = readNullableString(formData.get("reference"));

    const notes = readNullableString(formData.get("notes"));

    await updateJobCost(jobId, costId, {
      category,
      description,
      amountCents,
      ...(incurredAt ? { incurredAt } : {}),
      vendor,
      reference,
      notes,
    });

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to update job cost."),
      success: false,
    };
  }
}

export async function deleteJobCostAction(
  jobId: string,
  costId: string,
  _previousState: DeleteJobCostState,
): Promise<DeleteJobCostState> {
  void _previousState;

  try {
    await deleteJobCost(jobId, costId);

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to delete job cost."),
      success: false,
    };
  }
}

function revalidateJob(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

function readRequiredString(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const result = value.trim();

  if (!result) {
    throw new Error(`${label} is required.`);
  }

  return result;
}

function readOptionalString(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const result = value.trim();

  return result || undefined;
}

function readNullableString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result || null;
}

function readCategory(value: FormDataEntryValue | null): JobCostCategory {
  if (
    value === "MATERIAL" ||
    value === "LABOR" ||
    value === "SUBCONTRACTOR" ||
    value === "EQUIPMENT" ||
    value === "PERMIT" ||
    value === "TRAVEL" ||
    value === "OTHER"
  ) {
    return value;
  }

  throw new Error("Select a valid cost category.");
}

function readMoneyAsCents(value: FormDataEntryValue | null, label: string): number {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  const normalized = value.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(
      `${label} must be a valid dollar amount with no more than two decimal places.`,
    );
  }

  const [wholePart, decimalPart = ""] = normalized.split(".");

  const whole = Number(wholePart);

  const cents = Number(decimalPart.padEnd(2, "0"));

  const result = whole * 100 + cents;

  if (!Number.isSafeInteger(result) || result < 0) {
    throw new Error(`${label} is invalid.`);
  }

  return result;
}

function readOptionalDate(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Cost date is invalid.");
  }

  return `${normalized}T12:00:00.000Z`;
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 404) {
      return "The requested job or cost could not be found.";
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to perform this action.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function parseApiError(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: string | string[];
    };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    return null;
  } catch {
    return null;
  }
}
