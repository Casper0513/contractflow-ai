"use server";

import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/authenticated-api";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/active-organization";

export async function setActiveOrganization(organizationId: string): Promise<void> {
  const normalizedOrganizationId = organizationId.trim();

  if (!normalizedOrganizationId) {
    throw new Error("Organization ID is required");
  }

  const user = await getCurrentUser();

  const allowed = user.memberships.some(
    (membership) => membership.organization.id === normalizedOrganizationId,
  );

  if (!allowed) {
    throw new Error("You do not belong to the selected organization");
  }

  const cookieStore = await cookies();

  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, normalizedOrganizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
