"use server";

import { revalidatePath } from "next/cache";

import { ApiRequestError } from "@/lib/server-api";
import {
  inviteTeamMember,
  removeTeamMember,
  revokeTeamInvitation,
  updateTeamMemberRole,
} from "@/lib/team-members-api";
import type {
  InviteTeamMemberResult,
  TeamMember,
  TeamRole,
} from "@/lib/team-members-types";

export type TeamActionResult<T> =
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

const MANAGEABLE_ROLES = new Set<TeamRole>([
  "OWNER",
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "OFFICE",
  "VIEWER",
]);

const INVITABLE_ROLES = new Set<TeamRole>([
  "ADMIN",
  "MANAGER",
  "TECHNICIAN",
  "OFFICE",
  "VIEWER",
]);

export async function inviteTeamMemberAction(
  email: string,
  role: TeamRole,
): Promise<TeamActionResult<InviteTeamMemberResult>> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    return failure("Enter an email address.");
  }

  if (!INVITABLE_ROLES.has(role)) {
    return failure("Choose a valid invitation role.");
  }

  try {
    const result = await inviteTeamMember({
      email: normalizedEmail,
      role,
    });

    revalidateTeamSettings();

    return success(result);
  } catch (error) {
    return failure(getTeamActionError(error, "Unable to invite this team member."));
  }
}

export async function revokeTeamInvitationAction(
  invitationId: string,
): Promise<TeamActionResult<{ success: boolean }>> {
  if (!invitationId.trim()) {
    return failure("The invitation could not be identified.");
  }

  try {
    const result = await revokeTeamInvitation(invitationId);

    revalidateTeamSettings();

    return success(result);
  } catch (error) {
    return failure(getTeamActionError(error, "Unable to revoke this invitation."));
  }
}

export async function updateTeamMemberRoleAction(
  membershipId: string,
  role: TeamRole,
): Promise<TeamActionResult<TeamMember>> {
  if (!membershipId.trim()) {
    return failure("The team member could not be identified.");
  }

  if (!MANAGEABLE_ROLES.has(role)) {
    return failure("Choose a valid team role.");
  }

  try {
    const result = await updateTeamMemberRole(membershipId, role);

    revalidateTeamSettings();

    return success(result);
  } catch (error) {
    return failure(
      getTeamActionError(error, "Unable to update this team member's role."),
    );
  }
}

export async function removeTeamMemberAction(
  membershipId: string,
): Promise<TeamActionResult<{ success: boolean }>> {
  if (!membershipId.trim()) {
    return failure("The team member could not be identified.");
  }

  try {
    const result = await removeTeamMember(membershipId);

    revalidateTeamSettings();

    return success(result);
  } catch (error) {
    return failure(getTeamActionError(error, "Unable to remove this team member."));
  }
}

function revalidateTeamSettings() {
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

function success<T>(data: T): TeamActionResult<T> {
  return {
    success: true,
    data,
    error: null,
  };
}

function failure<T = never>(error: string): TeamActionResult<T> {
  return {
    success: false,
    data: null,
    error,
  };
}

function getTeamActionError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    const apiMessage = parseApiError(error.responseBody);

    if (apiMessage) {
      return apiMessage;
    }

    if (error.status === 401) {
      return "Your session has expired. Please sign in again.";
    }

    if (error.status === 403) {
      return "You do not have permission to manage this team.";
    }

    if (error.status === 404) {
      return "The requested team member or invitation could not be found.";
    }

    if (error.status === 409) {
      return "This team change conflicts with the current organization state.";
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
