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
