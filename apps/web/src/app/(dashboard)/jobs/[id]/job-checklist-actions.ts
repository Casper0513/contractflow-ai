"use server";

import { revalidatePath } from "next/cache";

import {
  applyChecklistTemplate,
  completeJobChecklistItem,
  deleteJobChecklist,
  reopenJobChecklistItem,
  updateJobChecklist,
  type ApplyChecklistTemplateInput,
  type JobChecklist,
  type JobChecklistItem,
  type UpdateJobChecklistInput,
} from "@/lib/job-checklists-api";
import { ApiRequestError } from "@/lib/server-api";

export type JobChecklistActionResult<T> =
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

export async function applyChecklistTemplateAction(
  jobId: string,
  input: ApplyChecklistTemplateInput,
): Promise<JobChecklistActionResult<JobChecklist>> {
  try {
    const checklist = await applyChecklistTemplate(jobId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: checklist,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to apply the checklist template."),
    };
  }
}

export async function updateJobChecklistAction(
  jobId: string,
  checklistId: string,
  input: UpdateJobChecklistInput,
): Promise<JobChecklistActionResult<JobChecklist>> {
  try {
    const checklist = await updateJobChecklist(jobId, checklistId, input);

    revalidateJob(jobId);

    return {
      success: true,
      data: checklist,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to update the checklist."),
    };
  }
}

export async function completeJobChecklistItemAction(
  jobId: string,
  checklistId: string,
  itemId: string,
): Promise<JobChecklistActionResult<JobChecklistItem>> {
  try {
    const item = await completeJobChecklistItem(jobId, checklistId, itemId);

    revalidateJob(jobId);

    return {
      success: true,
      data: item,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to complete the checklist item."),
    };
  }
}

export async function reopenJobChecklistItemAction(
  jobId: string,
  checklistId: string,
  itemId: string,
): Promise<JobChecklistActionResult<JobChecklistItem>> {
  try {
    const item = await reopenJobChecklistItem(jobId, checklistId, itemId);

    revalidateJob(jobId);

    return {
      success: true,
      data: item,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to reopen the checklist item."),
    };
  }
}

export async function deleteJobChecklistAction(
  jobId: string,
  checklistId: string,
): Promise<JobChecklistActionResult<{ success: boolean }>> {
  try {
    const result = await deleteJobChecklist(jobId, checklistId);

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
      error: getActionErrorMessage(error, "Unable to delete the checklist."),
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
      return "The requested job, checklist, template, or item could not be found.";
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
