"use server";

import { ApiRequestError, authenticatedApiRequest } from "@/lib/server-api";

export type InvoiceAiIntelligenceResponse = {
  intelligence: string;
  model: string;
  generatedAt: string;
};

export type InvoiceAiFollowUpDraftResponse = {
  subject: string;
  message: string;
  model: string;
  generatedAt: string;
};

export type InvoiceAiFollowUpDraftResult =
  | {
      draft: InvoiceAiFollowUpDraftResponse;
      error: null;
    }
  | {
      draft: null;
      error: string;
    };

export async function generateInvoiceAiIntelligence(
  invoiceId: string,
): Promise<InvoiceAiIntelligenceResponse> {
  return authenticatedApiRequest<InvoiceAiIntelligenceResponse>(
    `/ai/invoices/${invoiceId}/intelligence`,
    {
      method: "POST",
    },
  );
}

export async function generateInvoiceAiFollowUpDraft(
  invoiceId: string,
): Promise<InvoiceAiFollowUpDraftResult> {
  try {
    const draft = await authenticatedApiRequest<InvoiceAiFollowUpDraftResponse>(
      `/ai/invoices/${invoiceId}/follow-up-draft`,
      {
        method: "POST",
      },
    );

    return {
      draft,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        draft: null,
        error: getApiErrorMessage(
          error.responseBody,
          "ContractFlow AI could not prepare a payment follow-up draft.",
        ),
      };
    }

    console.error("Generate invoice AI follow-up draft failed:", error);

    return {
      draft: null,
      error: "ContractFlow AI could not prepare a payment follow-up draft.",
    };
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
