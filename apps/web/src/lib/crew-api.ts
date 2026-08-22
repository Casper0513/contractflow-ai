import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type CrewMember = {
  id: string;
  organizationId: string;

  firstName: string;
  lastName: string | null;

  email: string | null;
  phone: string | null;

  hourlyCostCents: number;

  active: boolean;

  createdAt: string;
  updatedAt: string;

  _count: {
    timeEntries: number;
  };
};

export type CreateCrewMemberInput = {
  firstName: string;
  lastName?: string;

  email?: string;
  phone?: string;

  hourlyCostCents: number;
};

export type UpdateCrewMemberInput = {
  firstName?: string;
  lastName?: string | null;

  email?: string | null;
  phone?: string | null;

  hourlyCostCents?: number;
};

export function getCrewMembers(): Promise<CrewMember[]> {
  return authenticatedApiRequest<CrewMember[]>("/crew");
}

export function getCrewMember(crewMemberId: string): Promise<CrewMember> {
  return authenticatedApiRequest<CrewMember>(`/crew/${crewMemberId}`);
}

export function createCrewMember(input: CreateCrewMemberInput): Promise<CrewMember> {
  return authenticatedApiRequest<CrewMember>("/crew", {
    method: "POST",
    body: input,
  });
}

export function updateCrewMember(
  crewMemberId: string,
  input: UpdateCrewMemberInput,
): Promise<CrewMember> {
  return authenticatedApiRequest<CrewMember>(`/crew/${crewMemberId}`, {
    method: "PATCH",
    body: input,
  });
}

export function deactivateCrewMember(crewMemberId: string): Promise<CrewMember> {
  return authenticatedApiRequest<CrewMember>(`/crew/${crewMemberId}/deactivate`, {
    method: "PATCH",
  });
}

export function activateCrewMember(crewMemberId: string): Promise<CrewMember> {
  return authenticatedApiRequest<CrewMember>(`/crew/${crewMemberId}/activate`, {
    method: "PATCH",
  });
}
