"use server";

import { revalidatePath } from "next/cache";

import {
  completeCustomerFollowUp,
  reopenCustomerFollowUp,
} from "@/lib/customer-internal-notes-api";

export async function completeFollowUpAction(customerId: string, followUpId: string) {
  await completeCustomerFollowUp(customerId, followUpId);

  revalidateFollowUpViews(customerId);
}

export async function reopenFollowUpAction(customerId: string, followUpId: string) {
  await reopenCustomerFollowUp(customerId, followUpId);

  revalidateFollowUpViews(customerId);
}

function revalidateFollowUpViews(customerId: string) {
  revalidatePath("/dashboard");
  revalidatePath("/follow-ups");

  revalidatePath(`/customers/${customerId}`);
}
