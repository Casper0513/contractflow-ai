import "server-only";

import { authenticatedApiRequest } from "@/lib/server-api";

export type BillingPlan = "STARTER" | "PRO" | "BUSINESS";
export type BillingInterval = "MONTHLY" | "ANNUAL";

export type BillingEntitlement =
  | "CORE_OPERATIONS"
  | "AUTOMATED_REMINDERS"
  | "AI_FEATURES"
  | "JOB_COSTING"
  | "CREW_TIME_TRACKING"
  | "ADVANCED_DISPATCH"
  | "CAPACITY_PLANNING";

export type BillingSubscriptionStatus =
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "UNPAID"
  | "PAUSED";

export type BillingSubscription = {
  id: string;
  organizationId: string;
  plan: BillingPlan;
  interval: BillingInterval;
  status: BillingSubscriptionStatus;
  stripePriceId: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelAt: string | null;
  canceledAt: string | null;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingResponse = {
  organizationId: string;
  subscription: BillingSubscription | null;
};

export type BillingAccessResponse = {
  organizationId: string;
  hasAccess: boolean;
  plan: BillingPlan | null;
  status: BillingSubscriptionStatus | null;
  entitlements: BillingEntitlement[];
};

export type BillingCheckoutResponse = {
  url: string;
};

export type BillingPortalResponse = {
  url: string;
};

export function getBillingAccess(): Promise<BillingAccessResponse> {
  return authenticatedApiRequest<BillingAccessResponse>("/billing/access");
}

export function getBilling(): Promise<BillingResponse> {
  return authenticatedApiRequest<BillingResponse>("/billing");
}

export function createBillingCheckout(input: {
  plan: BillingPlan;
  interval: BillingInterval;
}): Promise<BillingCheckoutResponse> {
  return authenticatedApiRequest<BillingCheckoutResponse>("/billing/checkout", {
    method: "POST",
    body: input,
  });
}

export function createBillingPortal(): Promise<BillingPortalResponse> {
  return authenticatedApiRequest<BillingPortalResponse>("/billing/portal", {
    method: "POST",
  });
}

export function hasBillingEntitlement(
  access: BillingAccessResponse,
  entitlement: BillingEntitlement,
): boolean {
  return access.entitlements.includes(entitlement);
}
