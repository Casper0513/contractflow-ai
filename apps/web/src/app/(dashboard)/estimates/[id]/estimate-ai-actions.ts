"use server";

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
          "ContractFlow AI could not prepare an estimate email draft.",
        ),
      };
    }

    console.error("Generate estimate AI send draft failed:", error);

    return {
      draft: null,
      error: "ContractFlow AI could not prepare an estimate email draft.",
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
