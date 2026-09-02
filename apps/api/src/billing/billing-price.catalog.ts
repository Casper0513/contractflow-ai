import { BillingInterval, BillingPlan } from '@contractflow/db';

import type { Environment } from '../config/environment';

export type BillingPriceEnvironmentKey =
  | 'STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID'
  | 'STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID'
  | 'STRIPE_BILLING_PRO_MONTHLY_PRICE_ID'
  | 'STRIPE_BILLING_PRO_ANNUAL_PRICE_ID'
  | 'STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID'
  | 'STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID';

export type BillingPriceCatalogEntry = {
  plan: BillingPlan;
  interval: BillingInterval;
  environmentKey: BillingPriceEnvironmentKey;
};

export const BILLING_PRICE_CATALOG: readonly BillingPriceCatalogEntry[] = [
  {
    plan: BillingPlan.STARTER,
    interval: BillingInterval.MONTHLY,
    environmentKey: 'STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID',
  },
  {
    plan: BillingPlan.STARTER,
    interval: BillingInterval.ANNUAL,
    environmentKey: 'STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID',
  },
  {
    plan: BillingPlan.PRO,
    interval: BillingInterval.MONTHLY,
    environmentKey: 'STRIPE_BILLING_PRO_MONTHLY_PRICE_ID',
  },
  {
    plan: BillingPlan.PRO,
    interval: BillingInterval.ANNUAL,
    environmentKey: 'STRIPE_BILLING_PRO_ANNUAL_PRICE_ID',
  },
  {
    plan: BillingPlan.BUSINESS,
    interval: BillingInterval.MONTHLY,
    environmentKey: 'STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID',
  },
  {
    plan: BillingPlan.BUSINESS,
    interval: BillingInterval.ANNUAL,
    environmentKey: 'STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID',
  },
];

type EnvironmentKeyCheck = BillingPriceEnvironmentKey extends keyof Environment
  ? true
  : never;

const environmentKeyCheck: EnvironmentKeyCheck = true;

void environmentKeyCheck;
