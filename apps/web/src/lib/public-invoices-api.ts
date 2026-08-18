export type PublicInvoiceStatus =
  "SENT" | "VIEWED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "VOIDED";

export type PublicInvoiceCustomer = {
  firstName: string;
  lastName: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
};

export type PublicInvoiceOrganization = {
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
  logoUrl: string | null;

  timezone: string;
  currency: string;
};

export type PublicInvoiceLineItem = {
  description: string;
  quantity: string;
  unitPriceCents: number;
  lineTotalCents: number;
  position: number;
};

export type PublicInvoicePayment = {
  method: string;
  amountCents: number;
  receivedAt: string;
};

export type PublicInvoice = {
  number: string;
  status: PublicInvoiceStatus;

  title: string | null;

  notes: string | null;
  terms: string | null;

  currency: string;

  issueDate: string;
  dueDate: string | null;

  subtotalCents: number;
  discountCents: number;

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

  customer: PublicInvoiceCustomer;

  job: {
    name: string;
  } | null;

  sourceEstimate: {
    number: string;
  } | null;

  organization: PublicInvoiceOrganization;

  lineItems: PublicInvoiceLineItem[];
  payments: PublicInvoicePayment[];
};

export async function getPublicInvoice(token: string): Promise<PublicInvoice | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(`${apiUrl}/public/invoices/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Public invoice request failed with status ${response.status}: ${body}`,
    );
  }

  return response.json() as Promise<PublicInvoice>;
}
