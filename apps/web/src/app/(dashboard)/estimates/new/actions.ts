"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createEstimate } from "@/lib/estimates-api";
import { ApiRequestError } from "@/lib/server-api";

export type CreateEstimateState = {
  error: string | null;
};

type RawLineItem = {
  description?: unknown;
  quantity?: unknown;
  unitPriceCents?: unknown;
};

export async function createEstimateAction(
  _previousState: CreateEstimateState,
  formData: FormData,
): Promise<CreateEstimateState> {
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

  const taxRate = taxPercent / 100;

  let estimateId: string;

  try {
    const estimate = await createEstimate({
      customerId,

      jobId: getOptionalValue(formData, "jobId"),

      title: getOptionalValue(formData, "title"),

      notes: getOptionalValue(formData, "notes"),

      terms: getOptionalValue(formData, "terms"),

      validUntil: getOptionalValue(formData, "validUntil"),

      discountCents,
      taxRate,

      lineItems: parsedLineItems.lineItems,
    });

    estimateId = estimate.id;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      console.error("Create estimate API error:", error.responseBody);
    } else {
      console.error("Create estimate failed:", error);
    }

    return {
      error: "Unable to create this estimate. Please try again.",
    };
  }

  revalidatePath("/estimates");

  revalidatePath(`/estimates/${estimateId}`);

  revalidatePath(`/customers/${customerId}`);

  revalidatePath("/customers");

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
