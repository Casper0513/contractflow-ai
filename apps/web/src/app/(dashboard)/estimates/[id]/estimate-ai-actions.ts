"use server";

import { authenticatedApiRequest } from "@/lib/server-api";

export type EstimateAiIntelligenceResponse = {
  intelligence: string;
  model: string;
  generatedAt: string;
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
