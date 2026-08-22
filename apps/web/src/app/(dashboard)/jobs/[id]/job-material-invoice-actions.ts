"use server";

import { revalidatePath } from "next/cache";

import { importMaterialsToInvoice } from "@/lib/invoices-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobMaterialInvoiceActionState = {
  error: string | null;
  success: boolean;
  importedCount: number;
};

export async function addJobMaterialsToInvoiceAction(
  jobId: string,
  _previousState: JobMaterialInvoiceActionState,
  formData: FormData,
): Promise<JobMaterialInvoiceActionState> {
  void _previousState;

  try {
    const invoiceId = readRequiredString(formData.get("invoiceId"), "Draft invoice");

    const materialIds = formData
      .getAll("materialIds")
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean);

    if (materialIds.length === 0) {
      throw new Error("Select at least one material to add.");
    }

    const uniqueMaterialIds = [...new Set(materialIds)];

    await importMaterialsToInvoice(invoiceId, {
      materialIds: uniqueMaterialIds,
    });

    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath("/invoices");
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
        "Unable to add the selected materials to the invoice.",
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
      return "The invoice or one of the selected materials could not be found.";
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to update this invoice.";
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
