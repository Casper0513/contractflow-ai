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

export type EstimatePdfStatus =
  "DRAFT" | "SENT" | "VIEWED" | "APPROVED" | "DECLINED" | "EXPIRED";

export type EstimatePdfCustomer = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type EstimatePdfJob = {
  name: string;
} | null;

export type EstimatePdfLineItem = {
  description: string;
  quantity: string;
  unitPriceCents: number;
  lineTotalCents: number;
};

export type EstimatePdfEstimate = {
  number: string;
  status: EstimatePdfStatus;

  title: string | null;

  currency: string;

  validUntil: string | Date | null;

  subtotalCents: number;
  discountCents: number;
  taxRate: string | number;
  taxCents: number;
  totalCents: number;

  notes: string | null;
  terms: string | null;

  customer: EstimatePdfCustomer;
  job: EstimatePdfJob;

  lineItems: EstimatePdfLineItem[];
};

export type EstimatePdfOrganization = {
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
