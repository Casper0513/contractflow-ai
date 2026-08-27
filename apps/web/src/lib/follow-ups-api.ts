import "server-only";

import type {
  CustomerInternalNote,
  InternalNoteUser,
} from "@/lib/customer-internal-notes-api";
import { authenticatedApiRequest } from "@/lib/server-api";

export type FollowUpCustomer = {
  id: string;

  firstName: string;
  lastName: string | null;
  companyName: string | null;

  archivedAt: string | null;
};

export type FollowUp = CustomerInternalNote & {
  customer: FollowUpCustomer;

  createdBy: InternalNoteUser | null;

  assignedTo: InternalNoteUser | null;

  completedBy: InternalNoteUser | null;
};

export function getFollowUps(): Promise<FollowUp[]> {
  return authenticatedApiRequest<FollowUp[]>("/follow-ups");
}
