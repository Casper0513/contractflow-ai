"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateInvoice } from "@/lib/invoices-api";
import { ApiRequestError } from "@/lib/server-api";

export type UpdateInvoiceState = {
  error: string | null;
};

type RawLineItem = {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
};

export async function updateInvoiceAction(
  invoiceId: string,
  _previousState: UpdateInvoiceState,
  formData: FormData,
): Promise<UpdateInvoiceState> {
  const customerId = getValue(formData, "customerId");

  if (!customerId) {
    return {
      error: "Select a customer.",
    };
  }

  const parsedLineItems = parseLineItems(getValue(formData, "lineItems"));

  if (parsedLineItems.error) {
    return {
      error: parsedLineItems.error,
    };
  }

  const discountValue = getOptionalValue(formData, "discount");

  const taxPercentValue = getOptionalValue(formData, "taxPercent");

  const discountCents = discountValue ? moneyToCents(discountValue) : 0;

  if (discountCents === null) {
    return {
      error: "Enter a valid discount.",
    };
  }

  const taxPercent = taxPercentValue ? Number(taxPercentValue) : 0;

  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
    return {
      error: "Tax rate must be between 0 and 100.",
    };
  }

  const issueDate = getValue(formData, "issueDate");

  if (!issueDate) {
    return {
      error: "Select an issue date.",
    };
  }

  try {
    await updateInvoice(invoiceId, {
      customerId,

      jobId: getOptionalValue(formData, "jobId") ?? null,

      /*
       * Send empty strings deliberately so existing values
       * can be cleared by the API.
       */
      title: getValue(formData, "title"),

      notes: getValue(formData, "notes"),

      terms: getValue(formData, "terms"),

      issueDate,

      dueDate: getOptionalValue(formData, "dueDate") ?? null,

      discountCents,

      taxRate: taxPercent / 100,

      lineItems: parsedLineItems.lineItems,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Update invoice API error:", error.responseBody);

      return {
        error: getApiErrorMessage(error.responseBody, "Unable to update this invoice."),
      };
    }

    console.error("Update invoice failed:", error);

    return {
      error: "Unable to update this invoice. Please try again.",
    };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath(`/invoices/${invoiceId}/edit`);

  revalidatePath(`/customers/${customerId}`);

  revalidatePath("/customers");
  revalidatePath("/jobs");
  revalidatePath("/dashboard");

  redirect(`/invoices/${invoiceId}`);
}

function parseLineItems(value: string):
  | {
      error: null;
      lineItems: Array<{
        description: string;
        quantity: number;
        unitPriceCents: number;
      }>;
    }
  | {
      error: string;
      lineItems: never[];
    } {
  if (!value) {
    return {
      error: "Add at least one line item.",
      lineItems: [],
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    return {
      error: "The invoice line items are invalid.",
      lineItems: [],
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      error: "Add at least one line item.",
      lineItems: [],
    };
  }

  const lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }> = [];

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index] as RawLineItem;

    if (!item || typeof item !== "object") {
      return {
        error: `Line item ${index + 1} is invalid.`,
        lineItems: [],
      };
    }

    const description =
      typeof item.description === "string" ? item.description.trim() : "";

    if (!description) {
      return {
        error: `Line item ${index + 1} needs a description.`,
        lineItems: [],
      };
    }

    const quantity = Number(item.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0 || decimalPlaces(quantity) > 4) {
      return {
        error: `Line item ${index + 1} has an invalid quantity.`,
        lineItems: [],
      };
    }

    const unitPriceCents = moneyToCents(item.unitPrice);

    if (unitPriceCents === null) {
      return {
        error: `Line item ${index + 1} has an invalid unit price.`,
        lineItems: [],
      };
    }

    lineItems.push({
      description,
      quantity,
      unitPriceCents,
    });
  }

  return {
    error: null,
    lineItems,
  };
}

function moneyToCents(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100);
}

function decimalPlaces(value: number) {
  const text = value.toString();

  if (!text.includes(".")) {
    return 0;
  }

  return text.split(".")[1]?.length ?? 0;
}

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function getOptionalValue(formData: FormData, key: string) {
  return getValue(formData, key) || undefined;
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
