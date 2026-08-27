import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type TeamMember = {
  membershipId: string;

  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;

  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
};

export function getTeamMembers(): Promise<TeamMember[]> {
  return authenticatedApiRequest<TeamMember[]>("/team-members");
}
