"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiRequestError } from "@/lib/server-api";
import { updateCustomer } from "@/lib/customers-api";

export type EditCustomerState = {
  error: string | null;
  fieldErrors?: Partial<
    Record<"firstName" | "lastName" | "companyName" | "email" | "phone" | "notes", string>
  >;
};

export async function updateCustomerAction(
  customerId: string,
  _previousState: EditCustomerState,
  formData: FormData,
): Promise<EditCustomerState> {
  const firstName = getValue(formData, "firstName");
  const email = getOptionalValue(formData, "email");

  const fieldErrors: EditCustomerState["fieldErrors"] = {};

  if (!firstName) {
    fieldErrors.firstName = "First name is required.";
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors,
    };
  }

  try {
    await updateCustomer(customerId, {
      firstName,
      lastName: getOptionalValue(formData, "lastName"),
      companyName: getOptionalValue(formData, "companyName"),
      email,
      phone: getOptionalValue(formData, "phone"),
      notes: getOptionalValue(formData, "notes"),
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Customer update API error:", error.responseBody);
    } else {
      console.error("Customer update failed:", error);
    }

    return {
      error: "Unable to update this customer. Please try again.",
    };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");

  redirect(`/customers/${customerId}`);
}

function getValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string): string | undefined {
  return getValue(formData, key) || undefined;
}
