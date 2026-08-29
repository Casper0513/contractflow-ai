"use server";

import { ApiRequestError, authenticatedApiRequest } from "@/lib/server-api";

export type DispatchAiCandidateInput = {
  rank: number;
  crewMemberId: string;
  date: string;
  startAt: string;
  utilizationPercent: number;
  remainingMinutes: number;
};

export type DispatchAiAnalysis = {
  recommendedRank: number;

  candidate: {
    rank: number;
    crewMemberId: string;
    crewMemberName: string;
    date: string;
    startAt: string;
    utilizationPercent: number;
    remainingMinutes: number;
    dailyCapacityMinutes: number;
  };

  reason: string;
  caution: string | null;

  model: string;
  generatedAt: string;
};

export type DispatchAiAnalysisResult =
  | {
      analysis: DispatchAiAnalysis;
      error: null;
    }
  | {
      analysis: null;
      error: string;
    };

export async function analyzeDispatchCandidates(
  jobId: string,
  candidates: DispatchAiCandidateInput[],
): Promise<DispatchAiAnalysisResult> {
  try {
    const analysis = await authenticatedApiRequest<DispatchAiAnalysis>(
      `/ai/jobs/${jobId}/dispatch-analysis`,
      {
        method: "POST",
        body: {
          candidates,
        },
      },
    );

    return {
      analysis,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        analysis: null,
        error: getApiErrorMessage(
          error.responseBody,
          "ContractFlow AI could not review these dispatch options.",
        ),
      };
    }

    console.error("Analyze dispatch candidates failed:", error);

    return {
      analysis: null,
      error: "ContractFlow AI could not review these dispatch options.",
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
