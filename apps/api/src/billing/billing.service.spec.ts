import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingInterval,
  BillingPlan,
  BillingSubscriptionStatus,
  prisma,
} from '@contractflow/db';
import Stripe from 'stripe';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';
import { BillingService } from './billing.service';

const stripeConfig: Partial<Record<keyof Environment, string>> = {
  STRIPE_SECRET_KEY: 'sk_test_contractflow',
  STRIPE_BILLING_STARTER_MONTHLY_PRICE_ID: 'price_starter_monthly',
  STRIPE_BILLING_STARTER_ANNUAL_PRICE_ID: 'price_starter_annual',
  STRIPE_BILLING_PRO_MONTHLY_PRICE_ID: 'price_pro_monthly',
  STRIPE_BILLING_PRO_ANNUAL_PRICE_ID: 'price_pro_annual',
  STRIPE_BILLING_BUSINESS_MONTHLY_PRICE_ID: 'price_business_monthly',
  STRIPE_BILLING_BUSINESS_ANNUAL_PRICE_ID: 'price_business_annual',
};

function createConfigService(): ConfigService<Environment, true> {
  return {
    get: jest.fn((key: keyof Environment) => stripeConfig[key]),
  } as unknown as ConfigService<Environment, true>;
}

function createMembershipService(): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn(),
  };
}

function createSubscription(
  overrides: Record<string, unknown> = {},
): Stripe.Subscription {
  return {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    metadata: {
      organizationId: 'org_1',
      billingPlan: 'STARTER',
    },
    cancel_at_period_end: false,
    canceled_at: null,
    trial_end: null,
    items: {
      data: [
        {
          id: 'si_1',
          price: {
            id: 'price_starter_monthly',
          },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

function createSubscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  subscription: Stripe.Subscription,
): Stripe.Event {
  return {
    id: 'evt_1',
    object: 'event',
    type,
    data: {
      object: subscription,
    },
  } as unknown as Stripe.Event;
}

describe('BillingService Checkout price routing', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [BillingPlan.STARTER, BillingInterval.MONTHLY, 'price_starter_monthly'],
    [BillingPlan.STARTER, BillingInterval.ANNUAL, 'price_starter_annual'],
    [BillingPlan.PRO, BillingInterval.MONTHLY, 'price_pro_monthly'],
    [BillingPlan.PRO, BillingInterval.ANNUAL, 'price_pro_annual'],
    [BillingPlan.BUSINESS, BillingInterval.MONTHLY, 'price_business_monthly'],
    [BillingPlan.BUSINESS, BillingInterval.ANNUAL, 'price_business_annual'],
  ] as const)(
    'routes %s/%s Checkout to %s',
    async (plan, interval, expectedPriceId) => {
      const membershipService = createMembershipService();

      jest.spyOn(membershipService, 'resolveForUser').mockResolvedValue({
        id: 'membership_1',
        userId: 'user_db_1',
        organizationId: 'org_1',
        role: 'OWNER',
      } as never);

      jest.spyOn(prisma.organization, 'findUniqueOrThrow').mockResolvedValue({
        id: 'org_1',
        name: 'ContractFlow Test',
        email: 'billing@example.com',
        billingSubscription: null,
      } as never);

      const service = new BillingService(
        createConfigService(),
        membershipService,
      );

      const stripe = (
        service as unknown as {
          stripe: Stripe;
        }
      ).stripe;

      const createCheckoutSession = jest
        .spyOn(stripe.checkout.sessions, 'create')
        .mockResolvedValue({
          id: 'cs_1',
          url: 'https://checkout.stripe.test/session',
        } as never);

      await expect(
        service.createCheckoutForUser('user_1', plan, interval, 'org_1'),
      ).resolves.toEqual({
        url: 'https://checkout.stripe.test/session',
      });

      expect(createCheckoutSession).toHaveBeenCalledTimes(1);

      const call = createCheckoutSession.mock.calls[0];

      if (!call) {
        throw new Error('Expected Stripe Checkout session creation');
      }

      const checkoutParams = call[0];

      if (!checkoutParams) {
        throw new Error('Expected Stripe Checkout session parameters');
      }

      expect(checkoutParams.line_items).toEqual([
        {
          price: expectedPriceId,
          quantity: 1,
        },
      ]);

      expect(checkoutParams.metadata).toEqual({
        organizationId: 'org_1',
        billingPlan: plan,
        billingInterval: interval,
      });

      expect(checkoutParams.subscription_data?.metadata).toEqual({
        organizationId: 'org_1',
        billingPlan: plan,
        billingInterval: interval,
      });
    },
  );
});

describe('BillingService Stripe webhook synchronization', () => {
  let service: BillingService;

  beforeEach(() => {
    jest.restoreAllMocks();

    service = new BillingService(
      createConfigService(),
      createMembershipService(),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('upserts a Stripe subscription for the referenced organization', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org_1',
    } as never);

    const upsert = jest
      .spyOn(prisma.billingSubscription, 'upsert')
      .mockResolvedValue({} as never);

    const subscription = createSubscription();

    await service.handleStripeWebhookEvent(
      createSubscriptionEvent('customer.subscription.updated', subscription),
    );

    expect(upsert).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_1',
      },
      create: {
        organizationId: 'org_1',
        plan: BillingPlan.STARTER,
        interval: BillingInterval.MONTHLY,
        status: BillingSubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripePriceId: 'price_starter_monthly',
        currentPeriodStart: new Date(1_700_000_000 * 1000),
        currentPeriodEnd: new Date(1_702_592_000 * 1000),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
      },
      update: {
        plan: BillingPlan.STARTER,
        interval: BillingInterval.MONTHLY,
        status: BillingSubscriptionStatus.ACTIVE,
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripePriceId: 'price_starter_monthly',
        currentPeriodStart: new Date(1_700_000_000 * 1000),
        currentPeriodEnd: new Date(1_702_592_000 * 1000),
        cancelAtPeriodEnd: false,
        canceledAt: null,
        trialEnd: null,
      },
    });
  });

  it.each([
    ['incomplete', BillingSubscriptionStatus.INCOMPLETE],
    ['incomplete_expired', BillingSubscriptionStatus.INCOMPLETE_EXPIRED],
    ['trialing', BillingSubscriptionStatus.TRIALING],
    ['active', BillingSubscriptionStatus.ACTIVE],
    ['past_due', BillingSubscriptionStatus.PAST_DUE],
    ['canceled', BillingSubscriptionStatus.CANCELED],
    ['unpaid', BillingSubscriptionStatus.UNPAID],
    ['paused', BillingSubscriptionStatus.PAUSED],
  ] as const)(
    'maps Stripe status %s to %s',
    async (stripeStatus, expectedStatus) => {
      jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
        id: 'org_1',
      } as never);

      const upsert = jest
        .spyOn(prisma.billingSubscription, 'upsert')
        .mockResolvedValue({} as never);

      await service.handleStripeWebhookEvent(
        createSubscriptionEvent(
          'customer.subscription.updated',
          createSubscription({
            status: stripeStatus,
          }),
        ),
      );

      expect(upsert).toHaveBeenCalledTimes(1);

      const call = upsert.mock.calls[0];

      if (!call) {
        throw new Error('Expected billing subscription upsert call');
      }

      expect(call[0].create.status).toBe(expectedStatus);
      expect(call[0].update.status).toBe(expectedStatus);
    },
  );

  it('maps an annual Stripe price to its plan and interval', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org_1',
    } as never);

    const upsert = jest
      .spyOn(prisma.billingSubscription, 'upsert')
      .mockResolvedValue({} as never);

    const subscription = createSubscription({
      items: {
        data: [
          {
            id: 'si_1',
            price: {
              id: 'price_business_annual',
            },
            current_period_start: 1_700_000_000,
            current_period_end: 1_731_536_000,
          },
        ],
      },
    });

    await service.handleStripeWebhookEvent(
      createSubscriptionEvent('customer.subscription.updated', subscription),
    );

    expect(upsert).toHaveBeenCalledTimes(1);

    const call = upsert.mock.calls[0];

    if (!call) {
      throw new Error('Expected billing subscription upsert call');
    }

    expect(call[0].create.plan).toBe(BillingPlan.BUSINESS);
    expect(call[0].create.interval).toBe(BillingInterval.ANNUAL);
    expect(call[0].update.plan).toBe(BillingPlan.BUSINESS);
    expect(call[0].update.interval).toBe(BillingInterval.ANNUAL);
  });

  it('rejects a subscription without organization metadata', async () => {
    const subscription = createSubscription({
      metadata: {},
    });

    await expect(
      service.handleStripeWebhookEvent(
        createSubscriptionEvent('customer.subscription.created', subscription),
      ),
    ).rejects.toThrow(
      'Stripe subscription is missing ContractFlow organization metadata',
    );
  });

  it('rejects a subscription referencing an unknown organization', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue(null);

    await expect(
      service.handleStripeWebhookEvent(
        createSubscriptionEvent(
          'customer.subscription.created',
          createSubscription(),
        ),
      ),
    ).rejects.toThrow('Stripe subscription references an unknown organization');
  });

  it('rejects an unknown ContractFlow Stripe price', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org_1',
    } as never);

    const subscription = createSubscription({
      items: {
        data: [
          {
            id: 'si_1',
            price: {
              id: 'price_unknown',
            },
            current_period_start: 1_700_000_000,
            current_period_end: 1_702_592_000,
          },
        ],
      },
    });

    await expect(
      service.handleStripeWebhookEvent(
        createSubscriptionEvent('customer.subscription.updated', subscription),
      ),
    ).rejects.toThrow('Stripe subscription uses an unknown ContractFlow price');
  });

  it('retrieves and synchronizes the subscription after Checkout completes', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org_1',
    } as never);

    const upsert = jest
      .spyOn(prisma.billingSubscription, 'upsert')
      .mockResolvedValue({} as never);

    const stripe = (
      service as unknown as {
        stripe: Stripe;
      }
    ).stripe;

    const retrieve = jest
      .spyOn(stripe.subscriptions, 'retrieve')
      .mockResolvedValue(createSubscription() as never);

    const event = {
      id: 'evt_checkout',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_1',
          mode: 'subscription',
          subscription: 'sub_1',
        },
      },
    } as unknown as Stripe.Event;

    await service.handleStripeWebhookEvent(event);

    expect(retrieve).toHaveBeenCalledWith('sub_1');
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('ignores Checkout events that are not subscription Checkout sessions', async () => {
    const organizationFind = jest.spyOn(prisma.organization, 'findUnique');

    const event = {
      id: 'evt_checkout_payment',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_payment',
          mode: 'payment',
          subscription: null,
        },
      },
    } as unknown as Stripe.Event;

    await expect(
      service.handleStripeWebhookEvent(event),
    ).resolves.toBeUndefined();

    expect(organizationFind).not.toHaveBeenCalled();
  });

  it('ignores unrelated Stripe events', async () => {
    const organizationFind = jest.spyOn(prisma.organization, 'findUnique');

    const event = {
      id: 'evt_unrelated',
      object: 'event',
      type: 'payment_intent.created',
      data: {
        object: {},
      },
    } as unknown as Stripe.Event;

    await expect(
      service.handleStripeWebhookEvent(event),
    ).resolves.toBeUndefined();

    expect(organizationFind).not.toHaveBeenCalled();
  });

  it('fails closed for an unsupported Stripe subscription status', async () => {
    jest.spyOn(prisma.organization, 'findUnique').mockResolvedValue({
      id: 'org_1',
    } as never);

    await expect(
      service.handleStripeWebhookEvent(
        createSubscriptionEvent(
          'customer.subscription.updated',
          createSubscription({
            status: 'future_status',
          }),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
