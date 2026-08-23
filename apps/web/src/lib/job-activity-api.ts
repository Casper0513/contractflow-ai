import "server-only";

import type { CustomerActivity } from "@/lib/customers-api";
import { authenticatedApiRequest } from "@/lib/server-api";

export type JobActivity = CustomerActivity;

export function getJobActivity(jobId: string): Promise<JobActivity[]> {
  return authenticatedApiRequest<JobActivity[]>(`/jobs/${jobId}/activity`);
}
