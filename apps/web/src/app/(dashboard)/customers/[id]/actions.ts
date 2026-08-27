"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  archiveCustomer,
  restoreCustomer,
  retryCustomerCommunication,
  sendCustomerEmail,
} from "@/lib/customers-api";

export type SendCustomerEmailActionState = {
  success: boolean;
  message: string;
};

export type RetryCommunicationActionState = {
  success: boolean;
  message: string;
};

export async function sendCustomerEmailAction(
  customerId: string,
  _previousState: SendCustomerEmailActionState,
  formData: FormData,
): Promise<SendCustomerEmailActionState> {
  const subject = String(formData.get("subject") ?? "").trim();

  const message = String(formData.get("message") ?? "").trim();

  if (!subject) {
    return {
      success: false,
      message: "Enter an email subject.",
    };
  }

  if (!message) {
    return {
      success: false,
      message: "Enter a message.",
    };
  }

  try {
    await sendCustomerEmail(customerId, {
      subject,
      message,
    });

    revalidatePath(`/customers/${customerId}`);

    return {
      success: true,
      message: "Email sent successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "The email could not be sent.",
    };
  }
}

export async function retryCommunicationAction(
  customerId: string,
  communicationId: string,
  _previousState: RetryCommunicationActionState,
  _formData: FormData,
): Promise<RetryCommunicationActionState> {
  try {
    await retryCustomerCommunication(customerId, communicationId);

    revalidatePath(`/customers/${customerId}`);

    return {
      success: true,
      message: "Email sent successfully.",
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "The email could not be retried.",
    };
  }
}

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
