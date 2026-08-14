"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { archiveJob, restoreJob } from "@/lib/jobs-api";

export async function archiveJobAction(jobId: string, customerId: string) {
  await archiveJob(jobId);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");

  redirect("/jobs");
}

export async function restoreJobAction(jobId: string, customerId: string) {
  await restoreJob(jobId);

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  revalidatePath("/dashboard");

  redirect(`/jobs/${jobId}`);
}
