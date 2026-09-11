import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

import type {
  InviteTeamMemberResult,
  TeamInvitation,
  TeamMember,
  TeamRole,
} from "./team-members-types";

export type { InviteTeamMemberResult, TeamInvitation, TeamMember, TeamRole };

export function getTeamMembers(): Promise<TeamMember[]> {
  return authenticatedApiRequest<TeamMember[]>("/team-members");
}

export async function getTeamInvitations(): Promise<TeamInvitation[]> {
  const invitations = await authenticatedApiRequest<TeamInvitation[]>(
    "/team-members/invitations",
  );

  const now = Date.now();

  return invitations.filter(
    (invitation) =>
      !invitation.acceptedAt &&
      !invitation.revokedAt &&
      new Date(invitation.expiresAt).getTime() > now,
  );
}

export function inviteTeamMember(input: {
  email: string;
  role: TeamRole;
}): Promise<InviteTeamMemberResult> {
  return authenticatedApiRequest<InviteTeamMemberResult>("/team-members/invitations", {
    method: "POST",
    body: input,
  });
}

export function revokeTeamInvitation(
  invitationId: string,
): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/team-members/invitations/${encodeURIComponent(invitationId)}`,
    {
      method: "DELETE",
    },
  );
}

export function updateTeamMemberRole(
  membershipId: string,
  role: TeamRole,
): Promise<TeamMember> {
  return authenticatedApiRequest<TeamMember>(
    `/team-members/${encodeURIComponent(membershipId)}/role`,
    {
      method: "PATCH",
      body: {
        role,
      },
    },
  );
}

export function removeTeamMember(membershipId: string): Promise<{ success: boolean }> {
  return authenticatedApiRequest<{ success: boolean }>(
    `/team-members/${encodeURIComponent(membershipId)}`,
    {
      method: "DELETE",
    },
  );
}
