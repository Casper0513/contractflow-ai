import "server-only";

import { authenticatedApiRequest } from "./server-api";

export type CurrentUserResponse = {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;

  memberships: Array<{
    id: string;
    role: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

export function getCurrentUser(): Promise<CurrentUserResponse> {
  return authenticatedApiRequest<CurrentUserResponse>("/auth/me");
}
