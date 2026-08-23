"use server";

import { revalidatePath } from "next/cache";

import {
  createJobPhoto,
  createJobPhotoUpload,
  deleteJobPhoto,
  type CreateJobPhotoInput,
  type CreateJobPhotoUploadInput,
  type JobPhoto,
  type JobPhotoUpload,
} from "@/lib/job-photos-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobPhotoActionResult<T> =
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

export async function createJobPhotoUploadAction(
  jobId: string,
  input: CreateJobPhotoUploadInput,
): Promise<JobPhotoActionResult<JobPhotoUpload>> {
  try {
    const upload = await createJobPhotoUpload(jobId, input);

    return {
      success: true,
      data: upload,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to prepare the photo upload."),
    };
  }
}

export async function createJobPhotoAction(
  jobId: string,
  input: CreateJobPhotoInput,
): Promise<JobPhotoActionResult<JobPhoto>> {
  try {
    const photo = await createJobPhoto(jobId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: photo,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to save the job photo."),
    };
  }
}

export async function deleteJobPhotoAction(
  jobId: string,
  photoId: string,
): Promise<JobPhotoActionResult<{ success: boolean }>> {
  try {
    const result = await deleteJobPhoto(jobId, photoId);

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
      error: getActionErrorMessage(error, "Unable to delete the job photo."),
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
      return "The requested job or photo could not be found.";
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
