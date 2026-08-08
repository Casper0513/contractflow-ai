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
  createdAt: string;
  updatedAt: string;
};

export function getCustomers(): Promise<Customer[]> {
  return authenticatedApiRequest<Customer[]>("/customers");
}

export function createCustomer(input: {
  firstName: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  notes?: string;
}): Promise<Customer> {
  return authenticatedApiRequest<Customer>("/customers", {
    method: "POST",
    body: input,
  });
}
