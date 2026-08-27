import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type CustomerInternalNoteKind = "NOTE" | "FOLLOW_UP";

export type InternalNoteUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type CustomerInternalNote = {
  id: string;
  organizationId: string;
  customerId: string;

  kind: CustomerInternalNoteKind;

  content: string;

  createdByUserId: string | null;
  assignedToUserId: string | null;

  dueAt: string | null;

  completedAt: string | null;
  completedByUserId: string | null;

  createdAt: string;
  updatedAt: string;

  createdBy: InternalNoteUser | null;
  assignedTo: InternalNoteUser | null;
  completedBy: InternalNoteUser | null;
};

export type CreateCustomerInternalNoteInput = {
  kind?: CustomerInternalNoteKind;

  content: string;

  assignedToUserId?: string | null;
  dueAt?: string | null;
};

export type UpdateCustomerInternalNoteInput = {
  kind?: CustomerInternalNoteKind;

  content?: string;

  assignedToUserId?: string | null;
  dueAt?: string | null;
};

export function getCustomerInternalNotes(
  customerId: string,
): Promise<CustomerInternalNote[]> {
  return authenticatedApiRequest<CustomerInternalNote[]>(
    `/customers/${customerId}/internal-notes`,
  );
}

export function createCustomerInternalNote(
  customerId: string,
  input: CreateCustomerInternalNoteInput,
): Promise<CustomerInternalNote> {
  return authenticatedApiRequest<CustomerInternalNote>(
    `/customers/${customerId}/internal-notes`,
    {
      method: "POST",
      body: input,
    },
  );
}

export function updateCustomerInternalNote(
  customerId: string,
  noteId: string,
  input: UpdateCustomerInternalNoteInput,
): Promise<CustomerInternalNote> {
  return authenticatedApiRequest<CustomerInternalNote>(
    `/customers/${customerId}/internal-notes/${noteId}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function deleteCustomerInternalNote(
  customerId: string,
  noteId: string,
): Promise<{
  success: boolean;
}> {
  return authenticatedApiRequest<{
    success: boolean;
  }>(`/customers/${customerId}/internal-notes/${noteId}`, {
    method: "DELETE",
  });
}

export function completeCustomerFollowUp(
  customerId: string,
  noteId: string,
): Promise<CustomerInternalNote> {
  return authenticatedApiRequest<CustomerInternalNote>(
    `/customers/${customerId}/internal-notes/${noteId}/complete`,
    {
      method: "POST",
    },
  );
}

export function reopenCustomerFollowUp(
  customerId: string,
  noteId: string,
): Promise<CustomerInternalNote> {
  return authenticatedApiRequest<CustomerInternalNote>(
    `/customers/${customerId}/internal-notes/${noteId}/reopen`,
    {
      method: "POST",
    },
  );
}
