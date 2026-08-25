"use server";

import { revalidatePath } from "next/cache";

import {
  activateChecklistTemplate,
  createChecklistTemplate,
  deactivateChecklistTemplate,
  deleteChecklistTemplate,
  updateChecklistTemplate,
  type ChecklistTemplate,
  type CreateChecklistTemplateInput,
  type UpdateChecklistTemplateInput,
} from "@/lib/checklist-templates-api";
import { ApiRequestError } from "@/lib/server-api";

export type ChecklistTemplateActionResult<T> =
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

export async function createChecklistTemplateAction(
  input: CreateChecklistTemplateInput,
): Promise<ChecklistTemplateActionResult<ChecklistTemplate>> {
  try {
    const template = await createChecklistTemplate(input);

    revalidateChecklistTemplates();

    return {
      success: true,
      data: template,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to create the checklist template."),
    };
  }
}

export async function updateChecklistTemplateAction(
  templateId: string,
  input: UpdateChecklistTemplateInput,
): Promise<ChecklistTemplateActionResult<ChecklistTemplate>> {
  try {
    const template = await updateChecklistTemplate(templateId, input);

    revalidateChecklistTemplates();

    return {
      success: true,
      data: template,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to update the checklist template."),
    };
  }
}

export async function activateChecklistTemplateAction(
  templateId: string,
): Promise<ChecklistTemplateActionResult<ChecklistTemplate>> {
  try {
    const template = await activateChecklistTemplate(templateId);

    revalidateChecklistTemplates();

    return {
      success: true,
      data: template,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to activate the checklist template."),
    };
  }
}

export async function deactivateChecklistTemplateAction(
  templateId: string,
): Promise<ChecklistTemplateActionResult<ChecklistTemplate>> {
  try {
    const template = await deactivateChecklistTemplate(templateId);

    revalidateChecklistTemplates();

    return {
      success: true,
      data: template,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to deactivate the checklist template."),
    };
  }
}

export async function deleteChecklistTemplateAction(
  templateId: string,
): Promise<ChecklistTemplateActionResult<{ success: boolean }>> {
  try {
    const result = await deleteChecklistTemplate(templateId);

    revalidateChecklistTemplates();

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: getActionErrorMessage(error, "Unable to delete the checklist template."),
    };
  }
}

function revalidateChecklistTemplates() {
  revalidatePath("/settings");

  /*
   * Active templates are also displayed on job pages, so invalidate the
   * job route tree after a template mutation.
   */
  revalidatePath("/jobs", "layout");
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
      return "You do not have permission to manage checklist templates.";
    }

    if (error.status === 404) {
      return "The requested checklist template could not be found.";
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
