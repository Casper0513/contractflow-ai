"use server";

import { authenticatedApiRequest } from "@/lib/server-api";

export type CustomerAiSummaryResponse = {
  summary: string;
  model: string;
  generatedAt: string;
};

export async function generateCustomerAiSummary(
  customerId: string,
): Promise<CustomerAiSummaryResponse> {
  return authenticatedApiRequest<CustomerAiSummaryResponse>(
    `/ai/customers/${customerId}/summary`,
    {
      method: "POST",
    },
  );
}
