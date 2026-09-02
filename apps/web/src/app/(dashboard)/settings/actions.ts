"use server";

import { revalidatePath } from "next/cache";

import {
  updateCurrentOrganization,
  type UpdateOrganizationProfileInput,
} from "@/lib/organizations-api";
import { ApiRequestError } from "@/lib/server-api";

export type BusinessProfileActionState = {
  success: boolean;
  message: string | null;
};

export async function updateBusinessProfileAction(
  _previousState: BusinessProfileActionState,
  formData: FormData,
): Promise<BusinessProfileActionState> {
  const name = getFormValue(formData, "name");

  if (!name || name.length < 2) {
    return {
      success: false,
      message: "Business name must be at least 2 characters.",
    };
  }

  const currency = getFormValue(formData, "currency");

  const input: UpdateOrganizationProfileInput = {
    name,

    legalName: getFormValue(formData, "legalName"),

    email: getFormValue(formData, "email"),
    phone: getFormValue(formData, "phone"),

    addressLine1: getFormValue(formData, "addressLine1"),
    addressLine2: getFormValue(formData, "addressLine2"),
    city: getFormValue(formData, "city"),
    province: getFormValue(formData, "province"),
    postalCode: getFormValue(formData, "postalCode"),
    country: getFormValue(formData, "country"),

    taxNumber: getFormValue(formData, "taxNumber"),

    website: getFormValue(formData, "website"),
    logoUrl: getFormValue(formData, "logoUrl"),

    timezone: getFormValue(formData, "timezone"),

    currency,
  };

  try {
    await updateCurrentOrganization(input);

    revalidatePath("/settings");
    revalidatePath("/invoices");
    revalidatePath("/estimates");

    return {
      success: true,
      message: "Business profile saved.",
    };
  } catch (error) {
    console.error("Failed to update business profile", error);

    if (error instanceof ApiRequestError) {
      return {
        success: false,
        message: getApiErrorMessage(error),
      };
    }

    return {
      success: false,
      message: "An unexpected error occurred while saving the business profile.",
    };
  }
}

function getFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getApiErrorMessage(error: ApiRequestError): string {
  try {
    const body = JSON.parse(error.responseBody) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(body.message)) {
      return body.message.join(" ");
    }

    if (typeof body.message === "string") {
      return body.message;
    }

    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Response was not JSON.
  }

  if (error.responseBody.trim()) {
    return error.responseBody.trim();
  }

  return `The API returned status ${error.status}.`;
}
