import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobTimeEntryCrewMember = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
};

export type JobTimeEntryCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobTimeEntry = {
  id: string;
  organizationId: string;
  jobId: string;
  crewMemberId: string;
  createdByUserId: string | null;

  startedAt: string;
  endedAt: string | null;

  /**
   * Snapshot of the crew member's internal hourly cost when
   * this time entry was created or its crew member was changed.
   */
  hourlyCostCents: number;

  /**
   * Zero while the entry is open. Once ended, this is calculated
   * by the API from duration × hourlyCostCents.
   */
  laborCostCents: number;
  currency: string;

  notes: string | null;

  createdAt: string;
  updatedAt: string;

  crewMember: JobTimeEntryCrewMember;
  createdBy: JobTimeEntryCreatedBy | null;
};

export type CreateJobTimeEntryInput = {
  crewMemberId: string;
  startedAt: string;
  endedAt?: string;
  notes?: string;
};

export type UpdateJobTimeEntryInput = {
  crewMemberId?: string;
  startedAt?: string;
  endedAt?: string | null;
  notes?: string | null;
};

export function getJobTimeEntries(jobId: string): Promise<JobTimeEntry[]> {
  return authenticatedApiRequest<JobTimeEntry[]>(`/jobs/${jobId}/time-entries`);
}

export function getJobTimeEntry(
  jobId: string,
  timeEntryId: string,
): Promise<JobTimeEntry> {
  return authenticatedApiRequest<JobTimeEntry>(
    `/jobs/${jobId}/time-entries/${timeEntryId}`,
  );
}

export function createJobTimeEntry(
  jobId: string,
  input: CreateJobTimeEntryInput,
): Promise<JobTimeEntry> {
  return authenticatedApiRequest<JobTimeEntry>(`/jobs/${jobId}/time-entries`, {
    method: "POST",
    body: input,
  });
}

export function updateJobTimeEntry(
  jobId: string,
  timeEntryId: string,
  input: UpdateJobTimeEntryInput,
): Promise<JobTimeEntry> {
  return authenticatedApiRequest<JobTimeEntry>(
    `/jobs/${jobId}/time-entries/${timeEntryId}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function deleteJobTimeEntry(
  jobId: string,
  timeEntryId: string,
): Promise<{ success: true }> {
  return authenticatedApiRequest<{ success: true }>(
    `/jobs/${jobId}/time-entries/${timeEntryId}`,
    {
      method: "DELETE",
    },
  );
}
