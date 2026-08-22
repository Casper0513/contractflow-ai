"use server";

import { revalidatePath } from "next/cache";

import {
  cancelJobMaterial,
  createJobMaterial,
  deleteJobMaterial,
  type JobMaterialUnit,
  orderJobMaterial,
  receiveJobMaterial,
  restoreJobMaterial,
  updateJobMaterial,
} from "@/lib/job-materials-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobMaterialActionState = {
  error: string | null;
  success: boolean;
};

export async function createJobMaterialAction(
  jobId: string,
  _previousState: JobMaterialActionState,
  formData: FormData,
): Promise<JobMaterialActionState> {
  void _previousState;

  try {
    const name = readRequiredString(formData.get("name"), "Material name");
    const description = readOptionalString(formData.get("description"));

    const quantity = readQuantity(formData.get("quantity"));
    const unit = readUnit(formData.get("unit"));

    const supplier = readOptionalString(formData.get("supplier"));
    const sku = readOptionalString(formData.get("sku"));
    const reference = readOptionalString(formData.get("reference"));
    const notes = readOptionalString(formData.get("notes"));

    const estimatedUnitCostCents = readOptionalMoneyAsCents(
      formData.get("estimatedUnitCost"),
      "Estimated unit cost",
    );

    const actualUnitCostCents = readOptionalMoneyAsCents(
      formData.get("actualUnitCost"),
      "Actual unit cost",
    );

    await createJobMaterial(jobId, {
      name,
      ...(description ? { description } : {}),
      quantity,
      unit,
      ...(supplier ? { supplier } : {}),
      ...(sku ? { sku } : {}),
      ...(reference ? { reference } : {}),
      ...(notes ? { notes } : {}),
      ...(estimatedUnitCostCents !== undefined ? { estimatedUnitCostCents } : {}),
      ...(actualUnitCostCents !== undefined ? { actualUnitCostCents } : {}),
    });

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to add material."),
      success: false,
    };
  }
}

export async function updateJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
  formData: FormData,
): Promise<JobMaterialActionState> {
  void _previousState;

  try {
    const name = readRequiredString(formData.get("name"), "Material name");
    const description = readNullableString(formData.get("description"));

    const quantity = readQuantity(formData.get("quantity"));
    const unit = readUnit(formData.get("unit"));

    const supplier = readNullableString(formData.get("supplier"));
    const sku = readNullableString(formData.get("sku"));
    const reference = readNullableString(formData.get("reference"));
    const notes = readNullableString(formData.get("notes"));

    const estimatedUnitCostCents = readNullableMoneyAsCents(
      formData.get("estimatedUnitCost"),
      "Estimated unit cost",
    );

    const actualUnitCostCents = readNullableMoneyAsCents(
      formData.get("actualUnitCost"),
      "Actual unit cost",
    );

    await updateJobMaterial(jobId, materialId, {
      name,
      description,
      quantity,
      unit,
      supplier,
      sku,
      reference,
      notes,
      estimatedUnitCostCents,
      actualUnitCostCents,
    });

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to update material."),
      success: false,
    };
  }
}

export async function orderJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
): Promise<JobMaterialActionState> {
  void _previousState;

  return runLifecycleAction(
    () => orderJobMaterial(jobId, materialId),
    jobId,
    "Unable to mark material as ordered.",
  );
}

export async function receiveJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
): Promise<JobMaterialActionState> {
  void _previousState;

  return runLifecycleAction(
    () => receiveJobMaterial(jobId, materialId),
    jobId,
    "Unable to mark material as received.",
  );
}

export async function cancelJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
): Promise<JobMaterialActionState> {
  void _previousState;

  return runLifecycleAction(
    () => cancelJobMaterial(jobId, materialId),
    jobId,
    "Unable to cancel material.",
  );
}

export async function restoreJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
): Promise<JobMaterialActionState> {
  void _previousState;

  return runLifecycleAction(
    () => restoreJobMaterial(jobId, materialId),
    jobId,
    "Unable to restore material.",
  );
}

export async function deleteJobMaterialAction(
  jobId: string,
  materialId: string,
  _previousState: JobMaterialActionState,
): Promise<JobMaterialActionState> {
  void _previousState;

  try {
    await deleteJobMaterial(jobId, materialId);

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, "Unable to delete material."),
      success: false,
    };
  }
}

async function runLifecycleAction(
  action: () => Promise<unknown>,
  jobId: string,
  fallback: string,
): Promise<JobMaterialActionState> {
  try {
    await action();

    revalidateJob(jobId);

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(error, fallback),
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

function readQuantity(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Quantity is required.");
  }

  const normalized = value.trim();

  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) {
    throw new Error(
      "Quantity must be greater than zero with no more than three decimal places.",
    );
  }

  const quantity = Number(normalized);

  if (!Number.isFinite(quantity) || quantity < 0.001) {
    throw new Error("Quantity must be at least 0.001.");
  }

  return quantity;
}

function readUnit(value: FormDataEntryValue | null): JobMaterialUnit {
  if (
    value === "EACH" ||
    value === "FOOT" ||
    value === "METER" ||
    value === "SQUARE_FOOT" ||
    value === "SQUARE_METER" ||
    value === "CUBIC_FOOT" ||
    value === "CUBIC_METER" ||
    value === "POUND" ||
    value === "KILOGRAM" ||
    value === "LITER" ||
    value === "GALLON" ||
    value === "BOX" ||
    value === "BAG" ||
    value === "BUNDLE" ||
    value === "ROLL" ||
    value === "SHEET" ||
    value === "OTHER"
  ) {
    return value;
  }

  throw new Error("Select a valid material unit.");
}

function readOptionalMoneyAsCents(
  value: FormDataEntryValue | null,
  label: string,
): number | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return parseMoneyAsCents(value, label);
}

function readNullableMoneyAsCents(
  value: FormDataEntryValue | null,
  label: string,
): number | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return parseMoneyAsCents(value, label);
}

function parseMoneyAsCents(value: string, label: string): number {
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

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 404) {
      return "The requested job or material could not be found.";
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
