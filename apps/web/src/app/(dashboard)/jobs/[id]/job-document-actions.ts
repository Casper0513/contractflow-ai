"use server";

import { revalidatePath } from "next/cache";

import {
  createJobDocument,
  createJobDocumentUpload,
  deleteJobDocument,
  type CreateJobDocumentInput,
  type CreateJobDocumentUploadInput,
  type JobDocument,
  type JobDocumentUpload,
} from "@/lib/job-documents-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobDocumentActionResult<T> =
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

export async function createJobDocumentUploadAction(
  jobId: string,
  input: CreateJobDocumentUploadInput,
): Promise<JobDocumentActionResult<JobDocumentUpload>> {
  try {
    const upload = await createJobDocumentUpload(jobId, input);

    return {
      success: true,
      data: upload,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to prepare the document upload."),
    };
  }
}

export async function createJobDocumentAction(
  jobId: string,
  input: CreateJobDocumentInput,
): Promise<JobDocumentActionResult<JobDocument>> {
  try {
    const document = await createJobDocument(jobId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: document,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to save the job document."),
    };
  }
}

export async function deleteJobDocumentAction(
  jobId: string,
  documentId: string,
): Promise<JobDocumentActionResult<{ success: boolean }>> {
  try {
    const result = await deleteJobDocument(jobId, documentId);

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
      error: getActionErrorMessage(error, "Unable to delete the job document."),
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
      return "The requested job or document could not be found.";
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
