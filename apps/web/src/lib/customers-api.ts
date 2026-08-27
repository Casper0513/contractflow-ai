import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type Customer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerActivity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: unknown;
  createdAt: string;
  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
};

export type CreateCustomerInput = {
  firstName: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export type UpdateCustomerInput = {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
};

export function getCustomers(includeArchived = false): Promise<Customer[]> {
  const query = includeArchived ? "?includeArchived=true" : "";

  return authenticatedApiRequest<Customer[]>(`/customers${query}`);
}

export function getCustomer(id: string): Promise<Customer> {
  return authenticatedApiRequest<Customer>(`/customers/${id}`);
}

export function getCustomerActivity(id: string): Promise<CustomerActivity[]> {
  return authenticatedApiRequest<CustomerActivity[]>(`/customers/${id}/activity`);
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return authenticatedApiRequest<Customer>("/customers", {
    method: "POST",
    body: input,
  });
}

export function updateCustomer(
  id: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  return authenticatedApiRequest<Customer>(`/customers/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function archiveCustomer(id: string): Promise<Customer> {
  return authenticatedApiRequest<Customer>(`/customers/${id}/archive`, {
    method: "PATCH",
  });
}

export function restoreCustomer(id: string): Promise<Customer> {
  return authenticatedApiRequest<Customer>(`/customers/${id}/restore`, {
    method: "PATCH",
  });
}

export type CustomerCommunication = {
  id: string;

  channel: "EMAIL";
  direction: "OUTBOUND";

  category: "GENERAL" | "ESTIMATE" | "INVOICE" | "PAYMENT" | "REMINDER";

  status: "PENDING" | "SENT" | "FAILED";

  recipientEmail: string;
  subject: string;
  textBody: string;

  provider: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;

  jobId: string | null;
  estimateId: string | null;
  invoiceId: string | null;
  paymentId: string | null;

  sentAt: string | null;
  createdAt: string;
  updatedAt: string;

  actor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;

  job: {
    id: string;
    name: string;
  } | null;

  estimate: {
    id: string;
    number: string;
  } | null;

  invoice: {
    id: string;
    number: string;
  } | null;
};

export type SendCustomerEmailInput = {
  subject: string;
  message: string;
};

export function getCustomerCommunications(id: string): Promise<CustomerCommunication[]> {
  return authenticatedApiRequest<CustomerCommunication[]>(
    `/customers/${id}/communications`,
  );
}

export function sendCustomerEmail(
  id: string,
  input: SendCustomerEmailInput,
): Promise<CustomerCommunication> {
  return authenticatedApiRequest<CustomerCommunication>(
    `/customers/${id}/communications`,
    {
      method: "POST",
      body: input,
    },
  );
}

export function retryCustomerCommunication(
  customerId: string,
  communicationId: string,
): Promise<CustomerCommunication> {
  return authenticatedApiRequest<CustomerCommunication>(
    `/customers/${customerId}/communications/${communicationId}/retry`,
    {
      method: "POST",
    },
  );
}
