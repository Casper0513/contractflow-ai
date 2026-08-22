import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type InvoiceStatus =
  "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOIDED";

export type InvoiceDirectoryStatus =
  | "ALL"
  | "DRAFT"
  | "SENT"
  | "VIEWED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOIDED"
  | "OUTSTANDING";

export type InvoiceSort =
  "newest" | "oldest" | "due-soonest" | "total-desc" | "balance-desc";

export type PaymentStatus = "RECORDED" | "VOIDED";

export type PaymentMethod =
  | "CASH"
  | "CHEQUE"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "E_TRANSFER"
  | "BANK_TRANSFER"
  | "OTHER";

export type InvoiceCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type InvoiceJob = {
  id: string;
  name: string;
  status:
    | "LEAD"
    | "ESTIMATING"
    | "APPROVED"
    | "SCHEDULED"
    | "IN_PROGRESS"
    | "ON_HOLD"
    | "COMPLETED"
    | "CANCELLED";
};

export type InvoiceSourceEstimate = {
  id: string;
  number: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "DECLINED" | "EXPIRED";
  title: string | null;
  totalCents: number;
};

export type InvoiceCreatedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type InvoicePaymentRecordedBy = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
};

export type InvoiceLineItem = {
  id: string;
  description: string;

  /**
   * Prisma Decimal values serialize through JSON as strings.
   */
  quantity: string;

  unitPriceCents: number;
  lineTotalCents: number;

  /**
   * Present when this line item originated from a job material.
   */
  sourceJobMaterialId: string | null;

  position: number;

  createdAt: string;
  updatedAt: string;
};

export type InvoicePayment = {
  id: string;

  status: PaymentStatus;
  method: PaymentMethod;

  amountCents: number;

  reference: string | null;
  notes: string | null;

  receivedAt: string;
  voidedAt: string | null;

  createdAt: string;
  updatedAt: string;

  recordedBy: InvoicePaymentRecordedBy | null;
};

export type Invoice = {
  id: string;
  organizationId: string;

  customerId: string;
  jobId: string | null;
  sourceEstimateId: string | null;
  createdByUserId: string | null;

  number: string;
  status: InvoiceStatus;

  title: string | null;

  notes: string | null;
  terms: string | null;

  currency: string;

  issueDate: string;
  dueDate: string | null;

  subtotalCents: number;
  discountCents: number;

  /**
   * Prisma Decimal values serialize through JSON as strings.
   *
   * Examples:
   * "0.0500" = 5%
   * "0.1300" = 13%
   */
  taxRate: string;

  taxCents: number;
  totalCents: number;

  amountPaidCents: number;
  balanceDueCents: number;

  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  overdueAt: string | null;
  voidedAt: string | null;

  createdAt: string;
  updatedAt: string;

  customer: InvoiceCustomer;
  job: InvoiceJob | null;
  sourceEstimate: InvoiceSourceEstimate | null;
  createdBy: InvoiceCreatedBy | null;

  lineItems: InvoiceLineItem[];
  payments: InvoicePayment[];
};

export type CreateInvoiceLineItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type CreateInvoiceInput = {
  customerId: string;

  jobId?: string;

  title?: string;
  notes?: string;
  terms?: string;

  issueDate?: string;
  dueDate?: string;

  discountCents?: number;

  /**
   * Decimal multiplier.
   *
   * Examples:
   * 0.05 = 5%
   * 0.13 = 13%
   */
  taxRate?: number;

  lineItems: CreateInvoiceLineItemInput[];
};

export type UpdateInvoiceLineItemInput = {
  description: string;
  quantity: number;
  unitPriceCents: number;
};

export type UpdateInvoiceInput = {
  customerId?: string;

  jobId?: string | null;

  title?: string;
  notes?: string;
  terms?: string;

  issueDate?: string;
  dueDate?: string | null;

  discountCents?: number;
  taxRate?: number;

  lineItems?: UpdateInvoiceLineItemInput[];
};

export type ImportInvoiceMaterialsInput = {
  materialIds: string[];
};

export type RecordInvoicePaymentInput = {
  amountCents: number;
  method: PaymentMethod;

  reference?: string;
  notes?: string;

  receivedAt?: string;
};

export type InvoiceListOptions = {
  query?: string;
  status?: InvoiceDirectoryStatus;
  sort?: InvoiceSort;
};

export type InvoiceSummary = {
  drafts: number;
  outstandingCents: number;
  overdueCents: number;
  paid: number;
  collectedCents: number;
};

export function getInvoices(options: InvoiceListOptions = {}): Promise<Invoice[]> {
  const searchParams = new URLSearchParams();

  if (options.query?.trim()) {
    searchParams.set("q", options.query.trim());
  }

  if (options.status && options.status !== "ALL") {
    searchParams.set("status", options.status);
  }

  if (options.sort && options.sort !== "newest") {
    searchParams.set("sort", options.sort);
  }

  const queryString = searchParams.toString();

  return authenticatedApiRequest<Invoice[]>(
    queryString ? `/invoices?${queryString}` : "/invoices",
  );
}

export function getInvoiceSummary(): Promise<InvoiceSummary> {
  return authenticatedApiRequest<InvoiceSummary>("/invoices/summary");
}

export function getJobInvoices(jobId: string): Promise<Invoice[]> {
  return authenticatedApiRequest<Invoice[]>(`/invoices/job/${jobId}`);
}

export function getCustomerInvoices(customerId: string): Promise<Invoice[]> {
  return authenticatedApiRequest<Invoice[]>(`/invoices/customer/${customerId}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}`);
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>("/invoices", {
    method: "POST",
    body: input,
  });
}

export function updateInvoice(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function importMaterialsToInvoice(
  id: string,
  input: ImportInvoiceMaterialsInput,
): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/materials`, {
    method: "POST",
    body: input,
  });
}

export function createInvoiceFromEstimate(estimateId: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/from-estimate/${estimateId}`, {
    method: "POST",
  });
}

export function sendInvoice(id: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/send`, {
    method: "PATCH",
  });
}

export function viewInvoice(id: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/view`, {
    method: "PATCH",
  });
}

export function markInvoiceOverdue(id: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/overdue`, {
    method: "PATCH",
  });
}

export function voidInvoice(id: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/void`, {
    method: "PATCH",
  });
}

export function recordInvoicePayment(
  id: string,
  input: RecordInvoicePaymentInput,
): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/payments`, {
    method: "POST",
    body: input,
  });
}

export function voidInvoicePayment(id: string, paymentId: string): Promise<Invoice> {
  return authenticatedApiRequest<Invoice>(`/invoices/${id}/payments/${paymentId}/void`, {
    method: "PATCH",
  });
}
