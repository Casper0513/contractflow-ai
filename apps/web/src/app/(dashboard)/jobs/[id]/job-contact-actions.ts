"use server";

import { revalidatePath } from "next/cache";

import {
  createJobContact,
  deleteJobContact,
  setPrimaryJobContact,
  updateJobContact,
  type CreateJobContactInput,
  type JobContact,
  type UpdateJobContactInput,
} from "@/lib/job-contacts-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobContactActionResult<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: string;
    };

export async function createJobContactAction(
  jobId: string,
  input: CreateJobContactInput,
): Promise<JobContactActionResult<JobContact>> {
  try {
    const contact = await createJobContact(jobId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: contact,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to create the job contact."),
    };
  }
}

export async function updateJobContactAction(
  jobId: string,
  contactId: string,
  input: UpdateJobContactInput,
): Promise<JobContactActionResult<JobContact>> {
  try {
    const contact = await updateJobContact(jobId, contactId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: contact,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to update the job contact."),
    };
  }
}

export async function setPrimaryJobContactAction(
  jobId: string,
  contactId: string,
): Promise<JobContactActionResult<JobContact>> {
  try {
    const contact = await setPrimaryJobContact(jobId, contactId);

    revalidateJob(jobId);

    return {
      success: true,
      data: contact,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to change the primary job contact."),
    };
  }
}

export async function deleteJobContactAction(
  jobId: string,
  contactId: string,
): Promise<JobContactActionResult<{ success: boolean }>> {
  try {
    const result = await deleteJobContact(jobId, contactId);

    revalidateJob(jobId);

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to delete the job contact."),
    };
  }
}

function revalidateJob(jobId: string) {
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  revalidatePath("/dashboard");
}

function getActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (error.status === 404) {
      return "The requested job or contact could not be found.";
    }

    return fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function parseApiError(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: string | string[];
    };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    return null;
  } catch {
    return null;
  }
}
