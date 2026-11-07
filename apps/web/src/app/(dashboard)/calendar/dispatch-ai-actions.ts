"use server";

import { getApiErrorMessage } from "@/lib/api-error-message";
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
          error.status,
          "ContractFlow AI could not review these dispatch options.",
        ),
      };
    }

    console.error("Analyze dispatch candidates failed:");

    return {
      analysis: null,
      error: "ContractFlow AI could not review these dispatch options.",
    };
  }
}
