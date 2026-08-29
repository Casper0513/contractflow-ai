"use server";

import { revalidatePath } from "next/cache";

import {
  completeCustomerFollowUp,
  createCustomerInternalNote,
  deleteCustomerInternalNote,
  reopenCustomerFollowUp,
  updateCustomerInternalNote,
  type CustomerInternalNoteKind,
} from "@/lib/customer-internal-notes-api";
import { ApiRequestError, authenticatedApiRequest } from "@/lib/server-api";

export type InternalNoteActionState = {
  success: boolean;
  message: string;
};

export type CustomerFollowUpSuggestion = {
  content: string;
  assignedToUserId: string | null;
  assignedTo: {
    id: string;
    name: string;
    email: string;
  } | null;
  dueDate: string;
  reason: string;
  model: string;
  generatedAt: string;
};

export type CustomerFollowUpSuggestionResult =
  | {
      suggestion: CustomerFollowUpSuggestion;
      error: null;
    }
  | {
      suggestion: null;
      error: string;
    };

export async function generateCustomerFollowUpSuggestionAction(
  customerId: string,
): Promise<CustomerFollowUpSuggestionResult> {
  try {
    const suggestion = await authenticatedApiRequest<CustomerFollowUpSuggestion>(
      `/ai/customers/${customerId}/follow-up-suggestion`,
      {
        method: "POST",
      },
    );

    return {
      suggestion,
      error: null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return {
        suggestion: null,
        error: getApiErrorMessage(
          error.responseBody,
          "ContractFlow AI could not suggest a follow-up.",
        ),
      };
    }

    console.error("Generate customer AI follow-up suggestion failed:", error);

    return {
      suggestion: null,
      error: "ContractFlow AI could not suggest a follow-up.",
    };
  }
}

export async function createInternalNoteAction(
  customerId: string,
  _previousState: InternalNoteActionState,
  formData: FormData,
): Promise<InternalNoteActionState> {
  const kind = normalizeKind(formData.get("kind"));

  const content = String(formData.get("content") ?? "").trim();

  const assignedToUserId = String(formData.get("assignedToUserId") ?? "").trim();

  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!content) {
    return {
      success: false,
      message: "Enter a note or follow-up.",
    };
  }

  try {
    await createCustomerInternalNote(customerId, {
      kind,
      content,

      assignedToUserId:
        kind === "FOLLOW_UP" && assignedToUserId ? assignedToUserId : null,

      dueAt: kind === "FOLLOW_UP" && dueDate ? dueDateToIso(dueDate) : null,
    });

    revalidateCustomerFollowUpViews(customerId);

    return {
      success: true,

      message: kind === "NOTE" ? "Internal note added." : "Follow-up added.",
    };
  } catch (error) {
    return {
      success: false,

      message: error instanceof Error ? error.message : "The item could not be created.",
    };
  }
}

export async function updateInternalNoteAction(
  customerId: string,
  noteId: string,
  _previousState: InternalNoteActionState,
  formData: FormData,
): Promise<InternalNoteActionState> {
  const kind = normalizeKind(formData.get("kind"));

  const content = String(formData.get("content") ?? "").trim();

  const assignedToUserId = String(formData.get("assignedToUserId") ?? "").trim();

  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!content) {
    return {
      success: false,
      message: "Enter a note or follow-up.",
    };
  }

  try {
    await updateCustomerInternalNote(customerId, noteId, {
      kind,
      content,

      assignedToUserId:
        kind === "FOLLOW_UP" && assignedToUserId ? assignedToUserId : null,

      dueAt: kind === "FOLLOW_UP" && dueDate ? dueDateToIso(dueDate) : null,
    });

    revalidateCustomerFollowUpViews(customerId);

    return {
      success: true,
      message: "Saved.",
    };
  } catch (error) {
    return {
      success: false,

      message: error instanceof Error ? error.message : "The item could not be updated.",
    };
  }
}

export async function completeInternalFollowUpAction(customerId: string, noteId: string) {
  await completeCustomerFollowUp(customerId, noteId);

  revalidateCustomerFollowUpViews(customerId);
}

export async function reopenInternalFollowUpAction(customerId: string, noteId: string) {
  await reopenCustomerFollowUp(customerId, noteId);

  revalidateCustomerFollowUpViews(customerId);
}

export async function deleteInternalNoteAction(customerId: string, noteId: string) {
  await deleteCustomerInternalNote(customerId, noteId);

  revalidateCustomerFollowUpViews(customerId);
}

function revalidateCustomerFollowUpViews(customerId: string) {
  revalidatePath(`/customers/${customerId}`);

  revalidatePath("/dashboard");

  revalidatePath("/follow-ups");
}

function getApiErrorMessage(responseBody: string, fallback: string) {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: unknown;
    };

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (Array.isArray(parsed.message)) {
      const messages = parsed.message.filter(
        (message): message is string => typeof message === "string",
      );

      if (messages.length > 0) {
        return messages.join(" ");
      }
    }
  } catch {
    // API response was not JSON.
  }

  return fallback;
}

function normalizeKind(value: FormDataEntryValue | null): CustomerInternalNoteKind {
  return value === "FOLLOW_UP" ? "FOLLOW_UP" : "NOTE";
}

function dueDateToIso(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}
