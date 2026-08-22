"use server";

import { revalidatePath } from "next/cache";

import { addMaterialsToEstimate } from "@/lib/estimates-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobMaterialEstimateActionState = {
  error: string | null;
  success: boolean;
  importedCount: number;
};

export async function addJobMaterialsToEstimateAction(
  jobId: string,
  _previousState: JobMaterialEstimateActionState,
  formData: FormData,
): Promise<JobMaterialEstimateActionState> {
  void _previousState;

  try {
    const estimateId = readRequiredString(formData.get("estimateId"), "Draft estimate");

    const materialIds = formData
      .getAll("materialIds")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    if (materialIds.length === 0) {
      throw new Error("Select at least one material to add.");
    }

    const uniqueMaterialIds = [...new Set(materialIds)];

    await addMaterialsToEstimate(estimateId, {
      materialIds: uniqueMaterialIds,
    });

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/estimates/${estimateId}`);
    revalidatePath("/estimates");
    revalidatePath("/dashboard");

    return {
      error: null,
      success: true,
      importedCount: uniqueMaterialIds.length,
    };
  } catch (error) {
    return {
      error: getActionErrorMessage(
        error,
        "Unable to add the selected materials to the estimate.",
      ),
      success: false,
      importedCount: 0,
    };
  }
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

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 404) {
      return "The estimate or one of the selected materials could not be found.";
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to update this estimate.";
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
