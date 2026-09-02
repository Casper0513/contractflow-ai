"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getJob, type JobPriority, type JobStatus, updateJob } from "@/lib/jobs-api";
import { getCurrencyFractionDigits, majorToMinor } from "@/lib/money";
import { ApiRequestError } from "@/lib/server-api";

export type EditJobState = {
  error: string | null;

  fieldErrors?: Partial<
    Record<"customerId" | "name" | "startDate" | "endDate" | "budget", string>
  >;
};

export async function updateJobAction(
  jobId: string,
  _previousState: EditJobState,
  formData: FormData,
): Promise<EditJobState> {
  let currency: string;

  try {
    const job = await getJob(jobId);
    currency = job.currency;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Get job API error:", error.responseBody);
    } else {
      console.error("Get job failed:", error);
    }

    return {
      error: "Unable to load this job. Please try again.",
    };
  }

  const customerId = getValue(formData, "customerId");

  const name = getValue(formData, "name");

  const startDate = getOptionalValue(formData, "startDate");

  const endDate = getOptionalValue(formData, "endDate");

  const budgetValue = getOptionalValue(formData, "budget");

  const fieldErrors: NonNullable<EditJobState["fieldErrors"]> = {};

  if (!customerId) {
    fieldErrors.customerId = "Select a customer.";
  }

  if (!name) {
    fieldErrors.name = "Job name is required.";
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    fieldErrors.endDate = "End date cannot be before the start date.";
  }

  let budgetCents: number | undefined;

  if (budgetValue) {
    try {
      budgetCents = parseMoneyAsMinor(budgetValue, "Budget", currency);
    } catch (error) {
      fieldErrors.budget =
        error instanceof Error ? error.message : "Enter a valid budget.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    await updateJob(jobId, {
      customerId,
      name,

      description: getOptionalValue(formData, "description"),

      status: getJobStatus(formData.get("status")),

      priority: getJobPriority(formData.get("priority")),

      addressLine1: getOptionalValue(formData, "addressLine1"),

      addressLine2: getOptionalValue(formData, "addressLine2"),

      city: getOptionalValue(formData, "city"),

      province: getOptionalValue(formData, "province"),

      postalCode: getOptionalValue(formData, "postalCode"),

      country: getOptionalValue(formData, "country") ?? "CA",

      startDate,
      endDate,
      budgetCents,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Update job API error:", error.responseBody);
    } else {
      console.error("Update job failed:", error);
    }

    return {
      error: "Unable to update this job. Please try again.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");

  redirect(`/jobs/${jobId}`);
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
}

function getJobStatus(value: FormDataEntryValue | null): JobStatus {
  const statuses: JobStatus[] = [
    "LEAD",
    "ESTIMATING",
    "APPROVED",
    "SCHEDULED",
    "IN_PROGRESS",
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
  ];

  return statuses.includes(value as JobStatus) ? (value as JobStatus) : "LEAD";
}

function getJobPriority(value: FormDataEntryValue | null): JobPriority {
  const priorities: JobPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

  return priorities.includes(value as JobPriority) ? (value as JobPriority) : "NORMAL";
}

function parseMoneyAsMinor(value: string, label: string, currency: string): number {
  const normalized = value.trim();
  const fractionDigits = getCurrencyFractionDigits(currency);

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} must be a valid ${currency} amount.`);
  }

  const decimalPart = normalized.split(".")[1] ?? "";

  if (decimalPart.length > fractionDigits) {
    throw new Error(
      `${label} cannot have more than ${fractionDigits} decimal place${
        fractionDigits === 1 ? "" : "s"
      } for ${currency}.`,
    );
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${label} is invalid.`);
  }

  return majorToMinor(amount, currency);
}
