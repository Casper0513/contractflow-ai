export type PublicEstimateStatus =
  "SENT" | "VIEWED" | "APPROVED" | "DECLINED" | "EXPIRED";

export type PublicEstimate = {
  number: string;
  status: PublicEstimateStatus;

  title: string | null;

  notes: string | null;
  terms: string | null;

  validUntil: string | null;

  subtotalCents: number;
  discountCents: number;

  taxRate: string;
  taxCents: number;
  totalCents: number;

  sentAt: string | null;
  viewedAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  expiredAt: string | null;

  customer: {
    firstName: string;
    lastName: string | null;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  };

  job: {
    name: string;
  } | null;

  organization: {
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

  lineItems: Array<{
    description: string;
    quantity: string;
    unitPriceCents: number;
    lineTotalCents: number;
    position: number;
  }>;
};

export async function getPublicEstimate(token: string): Promise<PublicEstimate | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const response = await fetch(
    `${apiUrl}/public/estimates/${encodeURIComponent(token)}`,
    {
      method: "GET",

      headers: {
        Accept: "application/json",
      },

      cache: "no-store",
    },
  );

  if (response.status === 404 || response.status === 400) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unable to load public estimate: ${response.status}`);
  }

  return (await response.json()) as PublicEstimate;
}
