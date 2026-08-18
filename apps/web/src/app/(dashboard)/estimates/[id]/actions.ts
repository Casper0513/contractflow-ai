"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  approveEstimate,
  declineEstimate,
  expireEstimate,
  sendEstimate,
  viewEstimate,
} from "@/lib/estimates-api";
import { createInvoiceFromEstimate } from "@/lib/invoices-api";
import { ApiRequestError } from "@/lib/server-api";

export type EstimateActionState = {
  error: string | null;
  success: string | null;
};

export type EstimateAction = "send" | "view" | "approve" | "decline" | "expire";

export type CreateInvoiceFromEstimateState = {
  error: string | null;
};

export async function runEstimateAction(
  estimateId: string,
  action: EstimateAction,
): Promise<EstimateActionState> {
  try {
    switch (action) {
      case "send":
        await sendEstimate(estimateId);
        break;

      case "view":
        await viewEstimate(estimateId);
        break;

      case "approve":
        await approveEstimate(estimateId);
        break;

      case "decline":
        await declineEstimate(estimateId);
        break;

      case "expire":
        await expireEstimate(estimateId);
        break;
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error(`Estimate ${action} API error:`, error.responseBody);

      return {
        error: getApiErrorMessage(
          error.responseBody,
          `Unable to ${action} this estimate.`,
        ),
        success: null,
      };
    }

    console.error(`Estimate ${action} failed:`, error);

    return {
      error: `Unable to ${action} this estimate. Please try again.`,
      success: null,
    };
  }

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/dashboard");

  return {
    error: null,
    success: getSuccessMessage(action),
  };
}

export async function createInvoiceFromEstimateAction(
  estimateId: string,
): Promise<CreateInvoiceFromEstimateState> {
  let invoiceId: string;

  try {
    const invoice = await createInvoiceFromEstimate(estimateId);

    invoiceId = invoice.id;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Create invoice from estimate API error:", error.responseBody);

      return {
        error: getApiErrorMessage(
          error.responseBody,
          "Unable to create an invoice from this estimate.",
        ),
      };
    }

    console.error("Create invoice from estimate failed:", error);

    return {
      error: "Unable to create an invoice from this estimate. Please try again.",
    };
  }

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);

  revalidatePath("/dashboard");

  redirect(`/invoices/${invoiceId}`);
}

function getSuccessMessage(action: EstimateAction) {
  switch (action) {
    case "send":
      return "Estimate marked as sent.";

    case "view":
      return "Estimate marked as viewed.";

    case "approve":
      return "Estimate approved.";

    case "decline":
      return "Estimate declined.";

    case "expire":
      return "Estimate marked as expired.";
  }
}

function getApiErrorMessage(responseBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: unknown;
    };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (message): message is string => typeof message === "string",
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch {
    // API response was not JSON.
  }

  return fallback;
}
