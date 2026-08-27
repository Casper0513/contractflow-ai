"use server";

import { revalidatePath } from "next/cache";

import { type JobStatus, updateJob } from "@/lib/jobs-api";
import { ApiRequestError } from "@/lib/server-api";

type JobStatusActionSuccess = {
  ok: true;
};

type JobStatusActionFailure = {
  ok: false;
  code: string;
  message: string;
  blockers: string[];
};

export type JobStatusActionResult = JobStatusActionSuccess | JobStatusActionFailure;

type ApiErrorBody = {
  message?: string;
  code?: string;
  blockers?: string[];
};

export async function updateJobStatusAction(
  jobId: string,
  customerId: string,
  status: JobStatus,
): Promise<JobStatusActionResult> {
  try {
    await updateJob(jobId, {
      status,
    });

    revalidatePath("/jobs");
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/customers");
    revalidatePath("/dashboard");

    return {
      ok: true,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      const body = parseApiErrorBody(error.responseBody);

      if (body?.code === "JOB_NOT_READY_FOR_COMPLETION") {
        return {
          ok: false,
          code: body.code,
          message: body.message ?? "Job is not ready to complete",
          blockers: Array.isArray(body.blockers) ? body.blockers : [],
        };
      }

      return {
        ok: false,
        code: body?.code ?? "JOB_STATUS_UPDATE_FAILED",
        message: body?.message ?? "Unable to update job status",
        blockers: [],
      };
    }

    console.error("Failed to update job status", error);

    return {
      ok: false,
      code: "JOB_STATUS_UPDATE_FAILED",
      message: "Unable to update job status",
      blockers: [],
    };
  }
}

function parseApiErrorBody(responseBody: string): ApiErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(responseBody);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const value = parsed as Record<string, unknown>;

    return {
      message: typeof value.message === "string" ? value.message : undefined,
      code: typeof value.code === "string" ? value.code : undefined,
      blockers: Array.isArray(value.blockers)
        ? value.blockers.filter(
            (blocker): blocker is string => typeof blocker === "string",
          )
        : undefined,
    };
  } catch {
    return null;
  }
}
