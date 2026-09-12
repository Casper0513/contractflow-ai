"use server";

import { revalidatePath } from "next/cache";

import {
  deleteCurrentAccount,
  leaveCurrentOrganization,
} from "@/lib/account-lifecycle-api";
import { ApiRequestError } from "@/lib/server-api";

export type LifecycleActionResult =
  | {
      success: true;
      error: null;
    }
  | {
      success: false;
      error: string;
    };

export async function leaveOrganizationAction(): Promise<LifecycleActionResult> {
  try {
    await leaveCurrentOrganization();

    revalidatePath("/", "layout");

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return lifecycleFailure(
      error,
      "Unable to leave this organization. Please try again.",
    );
  }
}

export async function deleteAccountAction(): Promise<LifecycleActionResult> {
  try {
    await deleteCurrentAccount();

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    return lifecycleFailure(error, "Unable to delete your account. Please try again.");
  }
}

function lifecycleFailure(error: unknown, fallback: string): LifecycleActionResult {
  if (error instanceof ApiRequestError) {
    const message = parseApiError(error.responseBody);

    if (message) {
      return {
        success: false,
        error: message,
      };
    }

    if (error.status === 401) {
      return {
        success: false,
        error: "Your session has expired. Please sign in again.",
      };
    }

    if (error.status === 409) {
      return {
        success: false,
        error: "Transfer ownership to another team member before continuing.",
      };
    }

    return {
      success: false,
      error: fallback,
    };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return {
    success: false,
    error: fallback,
  };
}

function parseApiError(responseBody: string): string | null {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: string | string[];
      error?: string;
    };

    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }

    if (typeof parsed.message === "string") {
      return parsed.message;
    }

    if (typeof parsed.error === "string") {
      return parsed.error;
    }

    return null;
  } catch {
    return responseBody.trim() || null;
  }
}
