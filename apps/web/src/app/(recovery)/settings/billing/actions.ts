"use server";

import { redirect } from "next/navigation";

import {
  createBillingCheckout,
  createBillingPortal,
  type BillingInterval,
  type BillingPlan,
} from "@/lib/billing-api";

const billingPlans = new Set<BillingPlan>(["STARTER", "PRO", "BUSINESS"]);
const billingIntervals = new Set<BillingInterval>(["MONTHLY", "ANNUAL"]);

export async function startBillingCheckout(formData: FormData): Promise<void> {
  const plan = formData.get("plan");
  const interval = formData.get("interval");

  if (
    typeof plan !== "string" ||
    typeof interval !== "string" ||
    !billingPlans.has(plan as BillingPlan) ||
    !billingIntervals.has(interval as BillingInterval)
  ) {
    throw new Error("Invalid billing plan selection");
  }

  const checkout = await createBillingCheckout({
    plan: plan as BillingPlan,
    interval: interval as BillingInterval,
  });

  redirect(checkout.url);
}

export async function openBillingPortal(): Promise<void> {
  const portal = await createBillingPortal();

  redirect(portal.url);
}
