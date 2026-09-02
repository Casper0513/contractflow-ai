"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateEstimate } from "@/lib/estimates-api";
import { ApiRequestError } from "@/lib/server-api";

export type UpdateEstimateState = {
  error: string | null;
};

type RawLineItem = {
  description?: unknown;
  quantity?: unknown;
  unitPriceCents?: unknown;
};

export async function updateEstimateAction(
  estimateId: string,
  _previousState: UpdateEstimateState,
  formData: FormData,
): Promise<UpdateEstimateState> {
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

  const discountValue = getOptionalValue(formData, "discountCents");

  const taxPercentValue = getOptionalValue(formData, "taxPercent");

  const discountCents = discountValue ? parseMinorUnits(discountValue) : 0;

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

  try {
    await updateEstimate(estimateId, {
      customerId,

      jobId: getOptionalValue(formData, "jobId") ?? null,

      title: getOptionalValue(formData, "title") ?? "",

      notes: getOptionalValue(formData, "notes") ?? "",

      terms: getOptionalValue(formData, "terms") ?? "",

      validUntil: getOptionalValue(formData, "validUntil") ?? null,

      discountCents,
      taxRate: taxPercent / 100,

      lineItems: parsedLineItems.lineItems,
    });
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Update estimate API error:", error.responseBody);

      return {
        error: getApiErrorMessage(error.responseBody, "Unable to update this estimate."),
      };
    }

    console.error("Update estimate failed:", error);

    return {
      error: "Unable to update this estimate. Please try again.",
    };
  }

  revalidatePath("/estimates");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath(`/estimates/${estimateId}/edit`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/dashboard");

  redirect(`/estimates/${estimateId}`);
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
      error: "The estimate line items are invalid.",
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

    const unitPriceCents = parseMinorUnits(item.unitPriceCents);

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

function parseMinorUnits(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isSafeInteger(amount) || amount < 0) {
    return null;
  }

  return amount;
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
    // Response was not JSON.
  }

  return fallback;
}
