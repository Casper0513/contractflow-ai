"use server";

import { revalidatePath } from "next/cache";

import {
  markInvoiceOverdue,
  recordInvoicePayment,
  runInvoiceReminderCheck,
  sendInvoice,
  sendInvoiceFollowUp,
  viewInvoice,
  voidInvoice,
  voidInvoicePayment,
  type PaymentMethod,
} from "@/lib/invoices-api";
import { ApiRequestError } from "@/lib/server-api";

export type InvoiceActionState = {
  error: string | null;
  success: string | null;
};

export type InvoiceAction = "send" | "view" | "overdue" | "void";

export async function runInvoiceAction(
  invoiceId: string,
  action: InvoiceAction,
): Promise<InvoiceActionState> {
  try {
    switch (action) {
      case "send":
        await sendInvoice(invoiceId);
        break;

      case "view":
        await viewInvoice(invoiceId);
        break;

      case "overdue":
        await markInvoiceOverdue(invoiceId);
        break;

      case "void":
        await voidInvoice(invoiceId);
        break;
    }
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error(`Invoice ${action} API error:`, error.responseBody);

      return {
        error: getApiErrorMessage(
          error.responseBody,
          `Unable to ${action} this invoice.`,
        ),
        success: null,
      };
    }

    console.error(`Invoice ${action} failed:`, error);

    return {
      error: `Unable to ${action} this invoice. Please try again.`,
      success: null,
    };
  }

  revalidateInvoicePaths(invoiceId);

  return {
    error: null,
    success: getInvoiceActionSuccessMessage(action),
  };
}

export async function sendReviewedInvoiceFollowUpAction(
  invoiceId: string,
  subject: string,
  message: string,
): Promise<InvoiceActionState> {
  const cleanedSubject = subject.trim();
  const cleanedMessage = message.trim();

  if (!cleanedSubject) {
    return {
      error: "Enter an email subject before sending.",
      success: null,
    };
  }

  if (cleanedSubject.length > 200) {
    return {
      error: "The email subject must be 200 characters or fewer.",
      success: null,
    };
  }

  if (!cleanedMessage) {
    return {
      error: "Enter an email message before sending.",
      success: null,
    };
  }

  if (cleanedMessage.length > 5000) {
    return {
      error: "The email message must be 5,000 characters or fewer.",
      success: null,
    };
  }

  try {
    await sendInvoiceFollowUp(invoiceId, {
      subject: cleanedSubject,
      message: cleanedMessage,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Reviewed invoice follow-up API error:", error.responseBody);

      return {
        error: getApiErrorMessage(
          error.responseBody,
          "Unable to send this payment follow-up.",
        ),
        success: null,
      };
    }

    console.error("Reviewed invoice follow-up failed:", error);

    return {
      error: "Unable to send this payment follow-up. Please try again.",
      success: null,
    };
  }

  revalidateInvoicePaths(invoiceId);

  return {
    error: null,
    success: "Payment follow-up emailed successfully.",
  };
}

export async function runInvoiceReminderCheckAction(
  invoiceId: string,
): Promise<InvoiceActionState> {
  try {
    const result = await runInvoiceReminderCheck(invoiceId);

    revalidateInvoicePaths(invoiceId);

    if (result.reminderSent && result.overdueMarked) {
      return {
        error: null,
        success: "Invoice marked overdue and reminder sent successfully.",
      };
    }

    if (result.reminderSent) {
      return {
        error: null,
        success: "Reminder sent successfully.",
      };
    }

    if (result.overdueMarked) {
      return {
        error: null,
        success: "Invoice marked overdue. No reminder is due yet.",
      };
    }

    return {
      error: null,
      success: "Reminder check complete. No reminder is due right now.",
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Invoice reminder check API error:", error.responseBody);

      return {
        error: getApiErrorMessage(
          error.responseBody,
          "Unable to run the reminder check.",
        ),
        success: null,
      };
    }

    console.error("Invoice reminder check failed:", error);

    return {
      error: "Unable to run the reminder check. Please try again.",
      success: null,
    };
  }
}

export async function recordInvoicePaymentAction(
  invoiceId: string,
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const amountValue = getValue(formData, "amountCents");

  if (!amountValue) {
    return {
      error: "Enter a payment amount.",
      success: null,
    };
  }

  const amountCents = parseMinorUnits(amountValue);

  if (amountCents === null || amountCents < 1) {
    return {
      error: "Enter a valid payment amount.",
      success: null,
    };
  }

  const methodValue = getValue(formData, "method");

  if (!isPaymentMethod(methodValue)) {
    return {
      error: "Select a valid payment method.",
      success: null,
    };
  }

  const receivedAt = getOptionalValue(formData, "receivedAt");

  try {
    await recordInvoicePayment(invoiceId, {
      amountCents,
      method: methodValue,
      reference: getOptionalValue(formData, "reference"),
      notes: getOptionalValue(formData, "notes"),
      receivedAt,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Record invoice payment API error:", error.responseBody);

      return {
        error: getApiErrorMessage(error.responseBody, "Unable to record this payment."),
        success: null,
      };
    }

    console.error("Record invoice payment failed:", error);

    return {
      error: "Unable to record this payment. Please try again.",
      success: null,
    };
  }

  revalidateInvoicePaths(invoiceId);

  return {
    error: null,
    success: "Payment recorded.",
  };
}

export async function voidInvoicePaymentAction(
  invoiceId: string,
  paymentId: string,
): Promise<InvoiceActionState> {
  try {
    await voidInvoicePayment(invoiceId, paymentId);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Void invoice payment API error:", error.responseBody);

      return {
        error: getApiErrorMessage(error.responseBody, "Unable to void this payment."),
        success: null,
      };
    }

    console.error("Void invoice payment failed:", error);

    return {
      error: "Unable to void this payment. Please try again.",
      success: null,
    };
  }

  revalidateInvoicePaths(invoiceId);

  return {
    error: null,
    success: "Payment voided.",
  };
}

function revalidateInvoicePaths(invoiceId: string) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/estimates");
  revalidatePath("/customers");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

function getInvoiceActionSuccessMessage(action: InvoiceAction) {
  switch (action) {
    case "send":
      return "Invoice emailed successfully.";

    case "view":
      return "Invoice marked as viewed.";

    case "overdue":
      return "Invoice marked as overdue.";

    case "void":
      return "Invoice voided.";
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

function parseMinorUnits(value: string) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount) || amount < 0) {
    return null;
  }

  return amount;
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
}

function isPaymentMethod(value: string): value is PaymentMethod {
  const methods: PaymentMethod[] = [
    "CASH",
    "CHEQUE",
    "CREDIT_CARD",
    "DEBIT_CARD",
    "E_TRANSFER",
    "BANK_TRANSFER",
    "OTHER",
  ];

  return methods.includes(value as PaymentMethod);
}
