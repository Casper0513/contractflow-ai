import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobStatus =
  | "LEAD"
  | "ESTIMATING"
  | "APPROVED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type JobPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type JobCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
};

export type JobCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type Job = {
  id: string;
  organizationId: string;
  customerId: string;
  createdByUserId: string | null;

  name: string;
  description: string | null;

  status: JobStatus;
  priority: JobPriority;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  startDate: string | null;
  endDate: string | null;

  currency: string;
  budgetCents: number | null;

  archivedAt: string | null;

  createdAt: string;
  updatedAt: string;

  customer: JobCustomer;
  createdBy: JobCreatedBy | null;
};

export type CreateJobInput = {
  customerId: string;
  name: string;
  description?: string;

  status?: JobStatus;
  priority?: JobPriority;

  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;

  startDate?: string;
  endDate?: string;

  budgetCents?: number;
};

export type UpdateJobInput = Partial<CreateJobInput>;

export function getJobs(includeArchived = false): Promise<Job[]> {
  const query = includeArchived ? "?includeArchived=true" : "";

  return authenticatedApiRequest<Job[]>(`/jobs${query}`);
}

export function getCustomerJobs(
  customerId: string,
  includeArchived = false,
): Promise<Job[]> {
  const query = includeArchived ? "?includeArchived=true" : "";

  return authenticatedApiRequest<Job[]>(`/jobs/customer/${customerId}${query}`);
}

export function getJob(id: string): Promise<Job> {
  return authenticatedApiRequest<Job>(`/jobs/${id}`);
}

export function getDispatchBacklogJobs(): Promise<Job[]> {
  return authenticatedApiRequest<Job[]>("/jobs/dispatch-backlog");
}

export function createJob(input: CreateJobInput): Promise<Job> {
  return authenticatedApiRequest<Job>("/jobs", {
    method: "POST",
    body: input,
  });
}

export function createJobFromEstimate(estimateId: string): Promise<Job> {
  return authenticatedApiRequest<Job>(`/jobs/from-estimate/${estimateId}`, {
    method: "POST",
  });
}

export function updateJob(id: string, input: UpdateJobInput): Promise<Job> {
  return authenticatedApiRequest<Job>(`/jobs/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function archiveJob(id: string): Promise<Job> {
  return authenticatedApiRequest<Job>(`/jobs/${id}/archive`, {
    method: "PATCH",
  });
}

export function restoreJob(id: string): Promise<Job> {
  return authenticatedApiRequest<Job>(`/jobs/${id}/restore`, {
    method: "PATCH",
  });
}
