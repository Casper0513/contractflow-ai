import { BillingPlan, BillingSubscriptionStatus } from '@contractflow/db';

import {
  BillingEntitlement,
  getBillingEntitlements,
  hasBillingEntitlement,
  hasSubscriptionAccess,
} from './billing-entitlement.policy';

describe('billing entitlement policy', () => {
  describe('subscription lifecycle access', () => {
    it.each([
      BillingSubscriptionStatus.TRIALING,
      BillingSubscriptionStatus.ACTIVE,
      BillingSubscriptionStatus.PAST_DUE,
    ])('allows paid access for %s', (status) => {
      expect(
        hasSubscriptionAccess({
          plan: BillingPlan.PRO,
          status,
        }),
      ).toBe(true);
    });

    it.each([
      BillingSubscriptionStatus.INCOMPLETE,
      BillingSubscriptionStatus.INCOMPLETE_EXPIRED,
      BillingSubscriptionStatus.CANCELED,
      BillingSubscriptionStatus.UNPAID,
      BillingSubscriptionStatus.PAUSED,
    ])('denies paid access for %s', (status) => {
      expect(
        hasSubscriptionAccess({
          plan: BillingPlan.PRO,
          status,
        }),
      ).toBe(false);
    });

    it('denies paid access when no subscription exists', () => {
      expect(hasSubscriptionAccess(null)).toBe(false);
    });
  });

  describe('Starter', () => {
    const subscription = {
      plan: BillingPlan.STARTER,
      status: BillingSubscriptionStatus.ACTIVE,
    };

    it('allows core operations', () => {
      expect(
        hasBillingEntitlement(subscription, BillingEntitlement.CORE_OPERATIONS),
      ).toBe(true);
    });

    it.each([
      BillingEntitlement.AUTOMATED_REMINDERS,
      BillingEntitlement.AI_FEATURES,
      BillingEntitlement.JOB_COSTING,
      BillingEntitlement.CREW_TIME_TRACKING,
      BillingEntitlement.ADVANCED_DISPATCH,
      BillingEntitlement.CAPACITY_PLANNING,
    ])('denies %s', (entitlement) => {
      expect(hasBillingEntitlement(subscription, entitlement)).toBe(false);
    });
  });

  describe('Pro', () => {
    const subscription = {
      plan: BillingPlan.PRO,
      status: BillingSubscriptionStatus.ACTIVE,
    };

    it.each([
      BillingEntitlement.CORE_OPERATIONS,
      BillingEntitlement.AUTOMATED_REMINDERS,
      BillingEntitlement.AI_FEATURES,
      BillingEntitlement.JOB_COSTING,
      BillingEntitlement.CREW_TIME_TRACKING,
    ])('allows %s', (entitlement) => {
      expect(hasBillingEntitlement(subscription, entitlement)).toBe(true);
    });

    it.each([
      BillingEntitlement.ADVANCED_DISPATCH,
      BillingEntitlement.CAPACITY_PLANNING,
    ])('denies %s', (entitlement) => {
      expect(hasBillingEntitlement(subscription, entitlement)).toBe(false);
    });
  });

  describe('Business', () => {
    const subscription = {
      plan: BillingPlan.BUSINESS,
      status: BillingSubscriptionStatus.ACTIVE,
    };

    it('allows every defined entitlement', () => {
      for (const entitlement of Object.values(BillingEntitlement)) {
        expect(hasBillingEntitlement(subscription, entitlement)).toBe(true);
      }
    });

    it('returns every defined entitlement', () => {
      expect(new Set(getBillingEntitlements(subscription))).toEqual(
        new Set(Object.values(BillingEntitlement)),
      );
    });
  });

  it('fails closed when subscription status is not entitled', () => {
    expect(
      getBillingEntitlements({
        plan: BillingPlan.BUSINESS,
        status: BillingSubscriptionStatus.CANCELED,
      }),
    ).toEqual([]);
  });
});
