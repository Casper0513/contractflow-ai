import "server-only";

import { authenticatedApiRequest } from "./server-api";

type SuccessResponse = {
  success: boolean;
};

export function leaveCurrentOrganization() {
  return authenticatedApiRequest<SuccessResponse>("/auth/organization-membership", {
    method: "DELETE",
  });
}

export function deleteCurrentAccount() {
  return authenticatedApiRequest<SuccessResponse>("/auth/account", {
    method: "DELETE",
  });
}
