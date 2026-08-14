import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type JobScheduleType =
  "WORK" | "SITE_VISIT" | "ESTIMATE" | "INSPECTION" | "DELIVERY" | "MEETING" | "OTHER";

export type JobScheduleStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type JobScheduleCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
};

export type JobScheduleJob = {
  id: string;
  name: string;
  customer: JobScheduleCustomer;
};

export type JobScheduleCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type JobSchedule = {
  id: string;
  organizationId: string;
  jobId: string;
  createdByUserId: string | null;

  type: JobScheduleType;
  status: JobScheduleStatus;

  title: string;
  description: string | null;

  startAt: string;
  endAt: string | null;
  allDay: boolean;

  location: string | null;
  notes: string | null;

  cancelledAt: string | null;

  createdAt: string;
  updatedAt: string;

  job: JobScheduleJob;
  createdBy: JobScheduleCreatedBy | null;
};

export type CreateJobScheduleInput = {
  title: string;
  description?: string;
  type?: JobScheduleType;
  status?: JobScheduleStatus;
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  location?: string;
  notes?: string;
};

export type UpdateJobScheduleInput = {
  title?: string;
  description?: string;
  type?: JobScheduleType;
  status?: JobScheduleStatus;
  startAt?: string;
  endAt?: string | null;
  allDay?: boolean;
  location?: string;
  notes?: string;
};

export function getJobSchedules(
  jobId: string,
  includeCancelled = false,
): Promise<JobSchedule[]> {
  const query = includeCancelled ? "?includeCancelled=true" : "";

  return authenticatedApiRequest<JobSchedule[]>(`/jobs/${jobId}/schedules${query}`);
}

export function createJobSchedule(
  jobId: string,
  input: CreateJobScheduleInput,
): Promise<JobSchedule> {
  return authenticatedApiRequest<JobSchedule>(`/jobs/${jobId}/schedules`, {
    method: "POST",
    body: input,
  });
}

export function updateJobSchedule(
  jobId: string,
  scheduleId: string,
  input: UpdateJobScheduleInput,
): Promise<JobSchedule> {
  return authenticatedApiRequest<JobSchedule>(`/jobs/${jobId}/schedules/${scheduleId}`, {
    method: "PATCH",
    body: input,
  });
}

export function cancelJobSchedule(
  jobId: string,
  scheduleId: string,
): Promise<JobSchedule> {
  return authenticatedApiRequest<JobSchedule>(
    `/jobs/${jobId}/schedules/${scheduleId}/cancel`,
    {
      method: "PATCH",
    },
  );
}

export function restoreJobSchedule(
  jobId: string,
  scheduleId: string,
): Promise<JobSchedule> {
  return authenticatedApiRequest<JobSchedule>(
    `/jobs/${jobId}/schedules/${scheduleId}/restore`,
    {
      method: "PATCH",
    },
  );
}

export function getOrganizationSchedules(options?: {
  from?: string;
  to?: string;
  includeCancelled?: boolean;
}): Promise<JobSchedule[]> {
  const params = new URLSearchParams();

  if (options?.from) {
    params.set("from", options.from);
  }

  if (options?.to) {
    params.set("to", options.to);
  }

  if (options?.includeCancelled) {
    params.set("includeCancelled", "true");
  }

  const query = params.toString();

  return authenticatedApiRequest<JobSchedule[]>(
    query ? `/schedules?${query}` : "/schedules",
  );
}
