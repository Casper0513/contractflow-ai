import "server-only";

import { auth } from "@clerk/nextjs/server";

import { getStoredActiveOrganizationId } from "./active-organization";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

type MembershipDiscoveryResponse = {
  memberships: Array<{
    organization: {
      id: string;
    };
  }>;
};

export async function authenticatedApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const authState = await auth();

  if (!authState.userId) {
    throw new Error("Not authenticated");
  }

  const token = await authState.getToken();

  if (!token) {
    throw new Error("Clerk did not return a session token");
  }

  const activeOrganizationId =
    path === "/auth/me" ? undefined : await resolveActiveOrganizationId(apiUrl, token);

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(activeOrganizationId
        ? {
            "x-organization-id": activeOrganizationId,
          }
        : {}),
      ...(options.body
        ? {
            "Content-Type": "application/json",
          }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new ApiRequestError(response.status, responseBody);
  }

  return response.json() as Promise<T>;
}

async function resolveActiveOrganizationId(
  apiUrl: string,
  token: string,
): Promise<string | undefined> {
  const storedOrganizationId = await getStoredActiveOrganizationId();

  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = await response.text();

    throw new ApiRequestError(response.status, responseBody);
  }

  const user = (await response.json()) as MembershipDiscoveryResponse;

  if (user.memberships.length === 0) {
    return undefined;
  }

  if (
    storedOrganizationId &&
    user.memberships.some(
      (membership) => membership.organization.id === storedOrganizationId,
    )
  ) {
    return storedOrganizationId;
  }

  return user.memberships[0]?.organization.id;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiRequestError";
  }
}
