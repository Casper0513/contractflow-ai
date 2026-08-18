import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type EstimateStatus =
  "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "DECLINED" | "EXPIRED";

export type EstimateCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type EstimateJob = {
  id: string;
  name: string;
  status:
    | "LEAD"
    | "ESTIMATING"
    | "APPROVED"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
};

export type EstimateCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type EstimateLineItem = {
  id: string;
  description: string;

  /**
   * Prisma Decimal values are serialized through JSON as strings.
   */
  quantity: string;

  unitPriceCents: number;
  lineTotalCents: number;

  position: number;

  createdAt: string;
  updatedAt: string;
};

export type Estimate = {
  id: string;
  organizationId: string;
  customerId: string;
  jobId: string | null;
  createdByUserId: string | null;

  number: string;
  status: EstimateStatus;
  title: string | null;

  notes: string | null;
  terms: string | null;

  validUntil: string | null;

  subtotalCents: number;
  discountCents: number;

  /**
   * Prisma Decimal values are serialized through JSON as strings.
   *
   * Example:
   * "0.0500" = 5%
   */
  taxRate: string;

  taxCents: number;
  totalCents: number;

  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;

  createdAt: string;
  updatedAt: string;

  customer: EstimateCustomer;
  job: EstimateJob | null;
  createdBy: EstimateCreatedBy | null;

  lineItems: EstimateLineItem[];
};

export type CreateEstimateLineItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type CreateEstimateInput = {
  customerId: string;

  jobId?: string;

  title?: string;
  notes?: string;
  terms?: string;

  validUntil?: string;

  discountCents?: number;

  /**
   * Decimal multiplier.
   *
   * Examples:
   * 0.05 = 5%
   * 0.13 = 13%
   */
  taxRate?: number;

  lineItems: CreateEstimateLineItemInput[];
};

export type UpdateEstimateLineItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type UpdateEstimateInput = {
  customerId?: string;

  jobId?: string | null;

  title?: string;
  notes?: string;
  terms?: string;

  validUntil?: string | null;

  discountCents?: number;
  taxRate?: number;

  lineItems?: UpdateEstimateLineItemInput[];
};

export function getEstimates(): Promise<Estimate[]> {
  return authenticatedApiRequest<Estimate[]>("/estimates");
}

export function getJobEstimates(jobId: string): Promise<Estimate[]> {
  return authenticatedApiRequest<Estimate[]>(`/estimates/job/${jobId}`);
}

export function getCustomerEstimates(customerId: string): Promise<Estimate[]> {
  return authenticatedApiRequest<Estimate[]>(`/estimates/customer/${customerId}`);
}

export function getEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}`);
}

export function createEstimate(input: CreateEstimateInput): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>("/estimates", {
    method: "POST",
    body: input,
  });
}

export function updateEstimate(
  id: string,
  input: UpdateEstimateInput,
): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function sendEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}/send`, {
    method: "PATCH",
  });
}

export function viewEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}/view`, {
    method: "PATCH",
  });
}

export function approveEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}/approve`, {
    method: "PATCH",
  });
}

export function declineEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}/decline`, {
    method: "PATCH",
  });
}

export function expireEstimate(id: string): Promise<Estimate> {
  return authenticatedApiRequest<Estimate>(`/estimates/${id}/expire`, {
    method: "PATCH",
  });
}
