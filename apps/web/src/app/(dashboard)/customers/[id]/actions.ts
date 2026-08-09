"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { archiveCustomer, restoreCustomer } from "@/lib/customers-api";

export async function archiveCustomerAction(customerId: string) {
  await archiveCustomer(customerId);

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");

  redirect("/customers");
}

export async function restoreCustomerAction(customerId: string) {
  await restoreCustomer(customerId);

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");

  redirect(`/customers/${customerId}`);
}
