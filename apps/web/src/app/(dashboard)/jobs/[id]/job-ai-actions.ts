"use server";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobAiSummaryResponse = {
  summary: string;
  model: string;
  generatedAt: string;
};

export async function generateJobAiSummary(jobId: string): Promise<JobAiSummaryResponse> {
  return authenticatedApiRequest<JobAiSummaryResponse>(`/ai/jobs/${jobId}/summary`, {
    method: "POST",
  });
}
