export type TeamRole = "OWNER" | "ADMIN" | "MANAGER" | "TECHNICIAN" | "OFFICE" | "VIEWER";

export type TeamMember = {
  membershipId: string;
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  role: TeamRole;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type InviteTeamMemberResult =
  | {
      kind: "MEMBERSHIP";
      membershipId: string;
      email: string;
      role: TeamRole;
    }
  | {
      kind: "INVITATION";
      invitationId: string;
      email: string;
      role: TeamRole;
      expiresAt: string;
    };
