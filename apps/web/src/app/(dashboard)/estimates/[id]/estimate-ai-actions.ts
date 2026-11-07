"use server";

import { getApiErrorMessage } from "@/lib/api-error-message";
import { ApiRequestError, authenticatedApiRequest } from "@/lib/server-api";

export type EstimateAiIntelligenceResponse = {
  intelligence: string;
  model: string;
  generatedAt: string;
};

export type EstimateAiSendDraftResponse = {
  subject: string;
  message: string;
  model: string;
  generatedAt: string;
};

export type EstimateAiSendDraftResult =
  | {
      draft: EstimateAiSendDraftResponse;
      error: null;
    }
  | {
      draft: null;
      error: string;
    };

export async function generateEstimateAiIntelligence(
  estimateId: string,
): Promise<EstimateAiIntelligenceResponse> {
  return authenticatedApiRequest<EstimateAiIntelligenceResponse>(
    `/ai/estimates/${estimateId}/intelligence`,
    {
      method: "POST",
    },
  );
}

export async function generateEstimateAiSendDraft(
  estimateId: string,
): Promise<EstimateAiSendDraftResult> {
  try {
    const draft = await authenticatedApiRequest<EstimateAiSendDraftResponse>(
      `/ai/estimates/${estimateId}/send-draft`,
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
          "ContractFlow AI could not prepare an estimate email draft.",
        ),
      };
    }

    console.error("Generate estimate AI send draft failed:");

    return {
      draft: null,
      error: "ContractFlow AI could not prepare an estimate email draft.",
    };
  }
}
