"use server";

import { redirect } from "next/navigation";

import {
  ApiRequestError,
  authenticatedApiRequest,
} from "@/lib/server-api";

export type OnboardingActionState = {
  error: string | null;
};

export async function createOrganizationAction(
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const body = {
    name: getValue(formData, "name"),
    legalName: getOptionalValue(formData, "legalName"),
    email: getOptionalValue(formData, "email"),
    phone: getOptionalValue(formData, "phone"),
    timezone:
      getOptionalValue(formData, "timezone") ??
      "America/Edmonton",
    currency:
      getOptionalValue(formData, "currency") ??
      "CAD",
  };

  if (body.name.length < 2) {
    return {
      error: "Company name must be at least 2 characters.",
    };
  }

  try {
    await authenticatedApiRequest("/organizations", {
      method: "POST",
      body,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error(error.responseBody);
    }

    return {
      error: "Unable to create company workspace.",
    };
  }

  redirect("/dashboard");
}

function getValue(
  formData: FormData,
  key: string,
): string {
  const value = formData.get(key);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function getOptionalValue(
  formData: FormData,
  key: string,
): string | undefined {
  return getValue(formData, key) || undefined;
}