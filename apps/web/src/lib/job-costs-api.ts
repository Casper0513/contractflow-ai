import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobCostCategory =
  "MATERIAL" | "LABOR" | "SUBCONTRACTOR" | "EQUIPMENT" | "PERMIT" | "TRAVEL" | "OTHER";

export type JobCostCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobCost = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  category: JobCostCategory;

  description: string;
  amountCents: number;

  incurredAt: string;

  vendor: string | null;
  reference: string | null;
  notes: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: JobCostCreatedBy | null;
};

export type JobCostCategoryTotals = Record<JobCostCategory, number>;

export type JobCostSummary = {
  jobId: string;

  budgetCents: number | null;
  actualCostCents: number;
  budgetVarianceCents: number | null;

  invoicedRevenueCents: number;
  collectedRevenueCents: number;

  grossProfitCents: number;
  grossMarginPercent: number | null;

  categoryTotals: JobCostCategoryTotals;
};

export type CreateJobCostInput = {
  category: JobCostCategory;

  description: string;
  amountCents: number;

  incurredAt?: string;

  vendor?: string;
  reference?: string;
  notes?: string;
};

export type UpdateJobCostInput = {
  category?: JobCostCategory;

  description?: string;
  amountCents?: number;

  incurredAt?: string;

  vendor?: string | null;
  reference?: string | null;
  notes?: string | null;
};

export function getJobCosts(jobId: string): Promise<JobCost[]> {
  return authenticatedApiRequest<JobCost[]>(`/jobs/${jobId}/costs`);
}

export function getJobCostSummary(jobId: string): Promise<JobCostSummary> {
  return authenticatedApiRequest<JobCostSummary>(`/jobs/${jobId}/costs/summary`);
}

export function createJobCost(
  jobId: string,
  input: CreateJobCostInput,
): Promise<JobCost> {
  return authenticatedApiRequest<JobCost>(`/jobs/${jobId}/costs`, {
    method: "POST",
    body: input,
  });
}

export function updateJobCost(
  jobId: string,
  costId: string,
  input: UpdateJobCostInput,
): Promise<JobCost> {
  return authenticatedApiRequest<JobCost>(`/jobs/${jobId}/costs/${costId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteJobCost(jobId: string, costId: string): Promise<{ success: true }> {
  return authenticatedApiRequest<{ success: true }>(`/jobs/${jobId}/costs/${costId}`, {
    method: "DELETE",
  });
}
