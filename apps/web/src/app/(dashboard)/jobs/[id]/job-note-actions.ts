"use server";

import { revalidatePath } from "next/cache";

import {
  createJobNote,
  deleteJobNote,
  updateJobNote,
  type CreateJobNoteInput,
  type JobNote,
  type UpdateJobNoteInput,
} from "@/lib/job-notes-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobNoteActionResult<T> =
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

export async function createJobNoteAction(
  jobId: string,
  input: CreateJobNoteInput,
): Promise<JobNoteActionResult<JobNote>> {
  try {
    const note = await createJobNote(jobId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: note,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to create the job note."),
    };
  }
}

export async function updateJobNoteAction(
  jobId: string,
  noteId: string,
  input: UpdateJobNoteInput,
): Promise<JobNoteActionResult<JobNote>> {
  try {
    const note = await updateJobNote(jobId, noteId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: note,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to update the job note."),
    };
  }
}

export async function deleteJobNoteAction(
  jobId: string,
  noteId: string,
): Promise<JobNoteActionResult<{ success: boolean }>> {
  try {
    const result = await deleteJobNote(jobId, noteId);

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
      error: getActionErrorMessage(error, "Unable to delete the job note."),
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
      return "The requested job or note could not be found.";
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
