import "server-only";

import { auth } from "@clerk/nextjs/server";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
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

  const response = await fetch(`${apiUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
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

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiRequestError";
  }
}
