"use server";

import { revalidatePath } from "next/cache";

import { type JobStatus, updateJob } from "@/lib/jobs-api";

export async function updateJobStatusAction(
  jobId: string,
  customerId: string,
  status: JobStatus,
) {
  await updateJob(jobId, {
    status,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");
}
