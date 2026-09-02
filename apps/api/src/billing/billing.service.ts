import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPlan,
  BillingSubscriptionStatus,
  Prisma,
  prisma,
} from '@contractflow/db';
import Stripe from 'stripe';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';

const billingSubscriptionSelect = {
  id: true,
  organizationId: true,
  plan: true,
  status: true,
  stripePriceId: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  canceledAt: true,
  trialEnd: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.BillingSubscriptionSelect;

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY', {
        infer: true,
      }),
    );
  }

  async getForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const subscription = await prisma.billingSubscription.findUnique({
      where: {
        organizationId: membership.organizationId,
      },
      select: billingSubscriptionSelect,
    });

    return {
      organizationId: membership.organizationId,
      subscription,
    };
  }

  async createCheckoutForUser(
    clerkUserId: string,
    plan: BillingPlan,
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const organization = await prisma.organization.findUniqueOrThrow({
      where: {
        id: membership.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        billingSubscription: {
          select: {
            status: true,
          },
        },
      },
    });

    if (
      organization.billingSubscription &&
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(
        organization.billingSubscription.status,
      )
    ) {
      throw new BadRequestException(
        'This organization already has a subscription',
      );
    }

    const priceId = this.getPriceId(plan);

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',

      client_reference_id: organization.id,

      customer_email: organization.email ?? undefined,

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      success_url: `${webUrl}/settings/billing?checkout=success`,
      cancel_url: `${webUrl}/settings/billing?checkout=cancelled`,

      metadata: {
        organizationId: organization.id,
        billingPlan: plan,
      },

      subscription_data: {
        metadata: {
          organizationId: organization.id,
          billingPlan: plan,
        },
      },

      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new BadRequestException('Stripe did not return a Checkout URL');
    }

    return {
      url: session.url,
    };
  }

  async createPortalForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const subscription = await prisma.billingSubscription.findUnique({
      where: {
        organizationId: membership.organizationId,
      },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!subscription) {
      throw new BadRequestException(
        'This organization does not have a billing subscription',
      );
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const portal = await this.stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${webUrl}/settings/billing`,
    });

    return {
      url: portal.url,
    };
  }

  async handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.mode !== 'subscription' || !session.subscription) {
          return;
        }

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;

        await this.syncStripeSubscription(subscriptionId);
        return;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.syncStripeSubscription(event.data.object);
        return;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;

        const parentSubscription =
          invoice.parent?.subscription_details?.subscription;

        if (!parentSubscription) {
          return;
        }

        const subscriptionId =
          typeof parentSubscription === 'string'
            ? parentSubscription
            : parentSubscription.id;

        await this.syncStripeSubscription(subscriptionId);
        return;
      }

      default:
        return;
    }
  }

  private async syncStripeSubscription(
    subscriptionOrId: Stripe.Subscription | string,
  ): Promise<void> {
    const subscription =
      typeof subscriptionOrId === 'string'
        ? await this.stripe.subscriptions.retrieve(subscriptionOrId)
        : subscriptionOrId;

    const organizationId = subscription.metadata.organizationId?.trim();

    if (!organizationId) {
      throw new BadRequestException(
        'Stripe subscription is missing ContractFlow organization metadata',
      );
    }

    const organization = await prisma.organization.findUnique({
      where: {
        id: organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new BadRequestException(
        'Stripe subscription references an unknown organization',
      );
    }

    const item = subscription.items.data[0];

    if (!item) {
      throw new BadRequestException(
        'Stripe subscription does not contain a subscription item',
      );
    }

    const stripePriceId = item.price.id;
    const plan = this.getPlanForPriceId(stripePriceId);

    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    /*
     * Stripe API v22 exposes the billing period on the
     * subscription item rather than relying on legacy
     * subscription-level period fields.
     */
    const currentPeriodStart =
      typeof item.current_period_start === 'number'
        ? new Date(item.current_period_start * 1000)
        : null;

    const currentPeriodEnd =
      typeof item.current_period_end === 'number'
        ? new Date(item.current_period_end * 1000)
        : null;

    const canceledAt =
      typeof subscription.canceled_at === 'number'
        ? new Date(subscription.canceled_at * 1000)
        : null;

    const trialEnd =
      typeof subscription.trial_end === 'number'
        ? new Date(subscription.trial_end * 1000)
        : null;

    await prisma.billingSubscription.upsert({
      where: {
        organizationId,
      },

      create: {
        organizationId,
        plan,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        trialEnd,
      },

      update: {
        plan,
        status: this.mapStripeSubscriptionStatus(subscription.status),
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        trialEnd,
      },
    });
  }

  private mapStripeSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): BillingSubscriptionStatus {
    switch (status) {
      case 'incomplete':
        return BillingSubscriptionStatus.INCOMPLETE;

      case 'incomplete_expired':
        return BillingSubscriptionStatus.INCOMPLETE_EXPIRED;

      case 'trialing':
        return BillingSubscriptionStatus.TRIALING;

      case 'active':
        return BillingSubscriptionStatus.ACTIVE;

      case 'past_due':
        return BillingSubscriptionStatus.PAST_DUE;

      case 'canceled':
        return BillingSubscriptionStatus.CANCELED;

      case 'unpaid':
        return BillingSubscriptionStatus.UNPAID;

      case 'paused':
        return BillingSubscriptionStatus.PAUSED;

      default:
        throw new BadRequestException(
          `Unsupported Stripe subscription status: ${status}`,
        );
    }
  }

  private getPlanForPriceId(priceId: string): BillingPlan {
    const priceMap: Array<[BillingPlan, string | undefined]> = [
      [
        BillingPlan.STARTER,
        this.configService.get('STRIPE_BILLING_STARTER_PRICE_ID', {
          infer: true,
        }),
      ],
      [
        BillingPlan.PRO,
        this.configService.get('STRIPE_BILLING_PRO_PRICE_ID', {
          infer: true,
        }),
      ],
      [
        BillingPlan.BUSINESS,
        this.configService.get('STRIPE_BILLING_BUSINESS_PRICE_ID', {
          infer: true,
        }),
      ],
    ];

    for (const [plan, configuredPriceId] of priceMap) {
      if (configuredPriceId && configuredPriceId === priceId) {
        return plan;
      }
    }

    throw new BadRequestException(
      'Stripe subscription uses an unknown ContractFlow price',
    );
  }

  private getPriceId(plan: BillingPlan): string {
    let priceId: string | undefined;

    switch (plan) {
      case BillingPlan.STARTER:
        priceId = this.configService.get('STRIPE_BILLING_STARTER_PRICE_ID', {
          infer: true,
        });
        break;

      case BillingPlan.PRO:
        priceId = this.configService.get('STRIPE_BILLING_PRO_PRICE_ID', {
          infer: true,
        });
        break;

      case BillingPlan.BUSINESS:
        priceId = this.configService.get('STRIPE_BILLING_BUSINESS_PRICE_ID', {
          infer: true,
        });
        break;
    }

    if (!priceId) {
      throw new ServiceUnavailableException(
        `Stripe billing is not configured for the ${plan} plan`,
      );
    }

    return priceId;
  }
}
