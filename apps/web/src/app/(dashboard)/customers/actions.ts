"use server";

import { revalidatePath } from "next/cache";

import { createCustomer } from "@/lib/customers-api";

export type CustomerFormState = {
  error: string | null;
  success: boolean;
};

export async function createCustomerAction(
  _previousState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const firstName = getValue(formData, "firstName");

  if (!firstName) {
    return {
      error: "First name is required.",
      success: false,
    };
  }

  try {
    await createCustomer({
      firstName,
      lastName: getOptionalValue(formData, "lastName"),
      companyName: getOptionalValue(formData, "companyName"),
      email: getOptionalValue(formData, "email"),
      phone: getOptionalValue(formData, "phone"),
      notes: getOptionalValue(formData, "notes"),
    });

    revalidatePath("/customers");
    revalidatePath("/dashboard");

    return {
      error: null,
      success: true,
    };
  } catch (error) {
    console.error("Create customer failed:", error);

    return {
      error: "Unable to create customer.",
      success: false,
    };
  }
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
