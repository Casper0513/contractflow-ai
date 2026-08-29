"use server";

import { authenticatedApiRequest } from "@/lib/server-api";

export type InvoiceAiIntelligenceResponse = {
  intelligence: string;
  model: string;
  generatedAt: string;
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
