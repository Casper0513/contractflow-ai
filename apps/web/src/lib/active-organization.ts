import "server-only";

import { cookies } from "next/headers";

export const ACTIVE_ORGANIZATION_COOKIE = "contractflow-active-organization";

export async function getStoredActiveOrganizationId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const value = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value.trim();

  return value || undefined;
}
