"use server";

import { getApiErrorMessage } from "@/lib/api-error-message";
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
          error.status,
          "ContractFlow AI could not prepare a payment follow-up draft.",
        ),
      };
    }

    console.error("Generate invoice AI follow-up draft failed:");

    return {
      draft: null,
      error: "ContractFlow AI could not prepare a payment follow-up draft.",
    };
  }
}
