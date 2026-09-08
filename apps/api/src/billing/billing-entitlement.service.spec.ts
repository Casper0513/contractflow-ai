import { BillingPlan, BillingSubscriptionStatus } from '@contractflow/db';

import { BillingEntitlement } from './billing-entitlement.policy';
import { BillingEntitlementService } from './billing-entitlement.service';

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    orm: {
      public: {
        BillingSubscription: {
          where: jest.fn(),
          select: jest.fn(),
          first: jest.fn(),
        },
      },
    },
  },
}));

type BillingSubscriptionQueryMock = {
  where: jest.Mock;
  select: jest.Mock;
  first: jest.Mock;
};

const mockedPrisma8 = jest.requireMock<{
  db: {
    orm: {
      public: {
        BillingSubscription: BillingSubscriptionQueryMock;
      };
    };
  };
}>('@contractflow/db-prisma8');

const billingSubscriptionQuery =
  mockedPrisma8.db.orm.public.BillingSubscription;

describe('BillingEntitlementService', () => {
  let service: BillingEntitlementService;

  beforeEach(() => {
    jest.clearAllMocks();

    billingSubscriptionQuery.where.mockReturnValue(billingSubscriptionQuery);

    billingSubscriptionQuery.select.mockReturnValue(billingSubscriptionQuery);

    service = new BillingEntitlementService();
  });

  it('returns null when the organization has no subscription', async () => {
    billingSubscriptionQuery.first.mockResolvedValue(null);

    await expect(
      service.getAccessStateForOrganization('org_1'),
    ).resolves.toBeNull();

    expect(billingSubscriptionQuery.where).toHaveBeenCalledWith({
      organizationId: 'org_1',
    });

    expect(billingSubscriptionQuery.select).toHaveBeenCalledWith(
      'plan',
      'status',
    );
  });

  it('returns the persisted plan and status', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.PRO,
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await expect(
      service.getAccessStateForOrganization('org_1'),
    ).resolves.toEqual({
      plan: BillingPlan.PRO,
      status: BillingSubscriptionStatus.ACTIVE,
    });
  });

  it('allows subscription access for an active subscription', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.STARTER,
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await expect(
      service.hasSubscriptionAccessForOrganization('org_1'),
    ).resolves.toBe(true);
  });

  it('denies subscription access when no subscription exists', async () => {
    billingSubscriptionQuery.first.mockResolvedValue(null);

    await expect(
      service.hasSubscriptionAccessForOrganization('org_1'),
    ).resolves.toBe(false);
  });

  it('allows a Pro entitlement for a Pro organization', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.PRO,
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await expect(
      service.hasEntitlementForOrganization(
        'org_1',
        BillingEntitlement.AI_FEATURES,
      ),
    ).resolves.toBe(true);
  });

  it('denies a Business-only entitlement for a Pro organization', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.PRO,
      status: BillingSubscriptionStatus.ACTIVE,
    });

    await expect(
      service.hasEntitlementForOrganization(
        'org_1',
        BillingEntitlement.ADVANCED_DISPATCH,
      ),
    ).resolves.toBe(false);
  });

  it('fails closed for a canceled Business subscription', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.BUSINESS,
      status: BillingSubscriptionStatus.CANCELED,
    });

    await expect(
      service.getEntitlementsForOrganization('org_1'),
    ).resolves.toEqual([]);
  });

  it('returns all Business entitlements while active', async () => {
    billingSubscriptionQuery.first.mockResolvedValue({
      plan: BillingPlan.BUSINESS,
      status: BillingSubscriptionStatus.ACTIVE,
    });

    const entitlements = await service.getEntitlementsForOrganization('org_1');

    expect(new Set(entitlements)).toEqual(
      new Set(Object.values(BillingEntitlement)),
    );
  });
});
