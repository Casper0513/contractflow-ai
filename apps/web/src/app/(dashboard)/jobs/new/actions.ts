"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createJob, type JobPriority, type JobStatus } from "@/lib/jobs-api";
import { ApiRequestError } from "@/lib/server-api";

export type CreateJobState = {
  error: string | null;
  fieldErrors?: Partial<
    Record<"customerId" | "name" | "startDate" | "endDate" | "budget", string>
  >;
};

export async function createJobAction(
  _previousState: CreateJobState,
  formData: FormData,
): Promise<CreateJobState> {
  const customerId = getValue(formData, "customerId");

  const name = getValue(formData, "name");

  const startDate = getOptionalValue(formData, "startDate");

  const endDate = getOptionalValue(formData, "endDate");

  const budgetValue = getOptionalValue(formData, "budget");

  const fieldErrors: NonNullable<CreateJobState["fieldErrors"]> = {};

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
    const budget = Number(budgetValue);

    if (!Number.isFinite(budget) || budget < 0) {
      fieldErrors.budget = "Enter a valid budget.";
    } else {
      budgetCents = Math.round(budget * 100);
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  let jobId: string;

  try {
    const job = await createJob({
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

    jobId = job.id;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Create job API error:", error.responseBody);
    } else {
      console.error("Create job failed:", error);
    }

    return {
      error: "Unable to create this job. Please try again.",
    };
  }

  revalidatePath("/jobs");
  revalidatePath("/customers");
  revalidatePath("/dashboard");
  revalidatePath(`/jobs/${jobId}`);

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
