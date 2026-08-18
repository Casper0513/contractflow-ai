export type InvoicePdfStatus =
  "DRAFT" | "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOIDED";

export type InvoicePdfPaymentStatus = "RECORDED" | "VOIDED";

export type InvoicePdfCustomer = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type InvoicePdfJob = {
  name: string;
} | null;

export type InvoicePdfSourceEstimate = {
  number: string;
} | null;

export type InvoicePdfLineItem = {
  description: string;
  quantity: string;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type InvoicePdfPayment = {
  status: InvoicePdfPaymentStatus;
  method: string;
  amountCents: number;
  reference: string | null;
  receivedAt: string | Date;
};

export type InvoicePdfInvoice = {
  number: string;
  status: InvoicePdfStatus;
  title: string | null;

  currency: string;

  issueDate: string | Date;
  dueDate: string | Date | null;

  subtotalCents: number;
  discountCents: number;
  taxRate: string | number;
  taxCents: number;
  totalCents: number;

  amountPaidCents: number;
  balanceDueCents: number;

  notes: string | null;
  terms: string | null;

  customer: InvoicePdfCustomer;
  job: InvoicePdfJob;
  sourceEstimate: InvoicePdfSourceEstimate;

  lineItems: InvoicePdfLineItem[];
  payments: InvoicePdfPayment[];
};

export type InvoicePdfOrganization = {
  name: string;
  legalName: string | null;

  email: string | null;
  phone: string | null;

  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;

  taxNumber: string | null;

  website: string | null;
};
