"use server";

import { authenticatedApiRequest } from "@/lib/server-api";

export type AiContextSummary = {
  activeCustomers: number;
  activeJobs: number;
  overdueInvoices: number;
  openEstimates: number;
  recentJobsIncluded: number;
};

export type AskAiResponse = {
  answer: string;
  model: string;
  context: AiContextSummary;
};

export async function askContractFlowAi(message: string): Promise<AskAiResponse> {
  const cleanedMessage = message.trim();

  if (!cleanedMessage) {
    throw new Error("Enter a question for ContractFlow AI.");
  }

  if (cleanedMessage.length > 4000) {
    throw new Error("Your question must be 4,000 characters or fewer.");
  }

  return authenticatedApiRequest<AskAiResponse>("/ai/ask", {
    method: "POST",
    body: {
      message: cleanedMessage,
    },
  });
}
