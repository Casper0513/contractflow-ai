import { BillingPlan, BillingSubscriptionStatus } from '@contractflow/db';

export enum BillingEntitlement {
  CORE_OPERATIONS = 'CORE_OPERATIONS',
  AUTOMATED_REMINDERS = 'AUTOMATED_REMINDERS',
  AI_FEATURES = 'AI_FEATURES',
  JOB_COSTING = 'JOB_COSTING',
  CREW_TIME_TRACKING = 'CREW_TIME_TRACKING',
  ADVANCED_DISPATCH = 'ADVANCED_DISPATCH',
  CAPACITY_PLANNING = 'CAPACITY_PLANNING',
}

export type BillingAccessState = {
  plan: BillingPlan;
  status: BillingSubscriptionStatus;
};

const ENTITLED_STATUSES = new Set<BillingSubscriptionStatus>([
  BillingSubscriptionStatus.TRIALING,
  BillingSubscriptionStatus.ACTIVE,
  BillingSubscriptionStatus.PAST_DUE,
]);

const PLAN_ENTITLEMENTS: Record<
  BillingPlan,
  ReadonlySet<BillingEntitlement>
> = {
  [BillingPlan.STARTER]: new Set([BillingEntitlement.CORE_OPERATIONS]),

  [BillingPlan.PRO]: new Set([
    BillingEntitlement.CORE_OPERATIONS,
    BillingEntitlement.AUTOMATED_REMINDERS,
    BillingEntitlement.AI_FEATURES,
    BillingEntitlement.JOB_COSTING,
    BillingEntitlement.CREW_TIME_TRACKING,
  ]),

  [BillingPlan.BUSINESS]: new Set([
    BillingEntitlement.CORE_OPERATIONS,
    BillingEntitlement.AUTOMATED_REMINDERS,
    BillingEntitlement.AI_FEATURES,
    BillingEntitlement.JOB_COSTING,
    BillingEntitlement.CREW_TIME_TRACKING,
    BillingEntitlement.ADVANCED_DISPATCH,
    BillingEntitlement.CAPACITY_PLANNING,
  ]),
};

export function hasSubscriptionAccess(
  subscription: BillingAccessState | null,
): boolean {
  if (!subscription) {
    return false;
  }

  return ENTITLED_STATUSES.has(subscription.status);
}

export function hasBillingEntitlement(
  subscription: BillingAccessState | null,
  entitlement: BillingEntitlement,
): boolean {
  if (!subscription || !hasSubscriptionAccess(subscription)) {
    return false;
  }

  return PLAN_ENTITLEMENTS[subscription.plan].has(entitlement);
}

export function getBillingEntitlements(
  subscription: BillingAccessState | null,
): BillingEntitlement[] {
  if (!subscription || !hasSubscriptionAccess(subscription)) {
    return [];
  }

  return [...PLAN_ENTITLEMENTS[subscription.plan]];
}
