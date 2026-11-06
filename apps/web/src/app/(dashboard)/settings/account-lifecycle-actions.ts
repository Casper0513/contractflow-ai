"use server";

import { revalidatePath } from "next/cache";

import {
  deleteCurrentAccount,
  leaveCurrentOrganization,
} from "@/lib/account-lifecycle-api";
import { parseApiErrorMessage } from "@/lib/api-error-message";
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
    const message = parseApiErrorMessage(error.responseBody);

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

  return {
    success: false,
    error: fallback,
  };
}
