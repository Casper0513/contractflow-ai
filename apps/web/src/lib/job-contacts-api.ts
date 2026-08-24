import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobContact = {
  id: string;
  organizationId: string;
  jobId: string;

  firstName: string;
  lastName: string | null;

  phone: string | null;
  email: string | null;

  role: string | null;
  notes: string | null;

  isPrimary: boolean;

  createdAt: string;
  updatedAt: string;
};

export type CreateJobContactInput = {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
  role?: string;
  notes?: string;
  isPrimary?: boolean;
};

export type UpdateJobContactInput = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  role?: string;
  notes?: string;
  isPrimary?: boolean;
};

export function getJobContacts(jobId: string): Promise<JobContact[]> {
  return authenticatedApiRequest<JobContact[]>(`/jobs/${jobId}/contacts`);
}

export function createJobContact(
  jobId: string,
  input: CreateJobContactInput,
): Promise<JobContact> {
  return authenticatedApiRequest<JobContact>(`/jobs/${jobId}/contacts`, {
    method: "POST",
    body: input,
  });
}

export function updateJobContact(
  jobId: string,
  contactId: string,
  input: UpdateJobContactInput,
): Promise<JobContact> {
  return authenticatedApiRequest<JobContact>(`/jobs/${jobId}/contacts/${contactId}`, {
    method: "PATCH",
    body: input,
  });
}

export function setPrimaryJobContact(
  jobId: string,
  contactId: string,
): Promise<JobContact> {
  return authenticatedApiRequest<JobContact>(
    `/jobs/${jobId}/contacts/${contactId}/primary`,
    {
      method: "PATCH",
    },
  );
}

export function deleteJobContact(
  jobId: string,
  contactId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/jobs/${jobId}/contacts/${contactId}`,
    {
      method: "DELETE",
    },
  );
}
