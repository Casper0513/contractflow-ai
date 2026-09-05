import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingInterval,
  BillingPlan,
  BillingSubscriptionStatus,
} from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';
import Stripe from 'stripe';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import type { Environment } from '../config/environment';
import { BILLING_PRICE_CATALOG } from './billing-price.catalog';

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

    const subscription = await db.orm.public.BillingSubscription.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'plan',
        'interval',
        'status',
        'stripePriceId',
        'currentPeriodStart',
        'currentPeriodEnd',
        'cancelAtPeriodEnd',
        'canceledAt',
        'trialEnd',
        'createdAt',
        'updatedAt',
      )
      .first();

    return {
      organizationId: membership.organizationId,

      subscription: subscription
        ? {
            ...subscription,

            currentPeriodStart: subscription.currentPeriodStart
              ? fromPrisma8Timestamp(subscription.currentPeriodStart)
              : null,

            currentPeriodEnd: subscription.currentPeriodEnd
              ? fromPrisma8Timestamp(subscription.currentPeriodEnd)
              : null,

            canceledAt: subscription.canceledAt
              ? fromPrisma8Timestamp(subscription.canceledAt)
              : null,

            trialEnd: subscription.trialEnd
              ? fromPrisma8Timestamp(subscription.trialEnd)
              : null,

            createdAt: fromPrisma8Timestamp(subscription.createdAt),

            updatedAt: fromPrisma8Timestamp(subscription.updatedAt),
          }
        : null,
    };
  }

  async createCheckoutForUser(
    clerkUserId: string,
    plan: BillingPlan,
    interval: BillingInterval,
    activeOrganizationId?: string,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );

    const organization = await db.orm.public.Organization.where({
      id: membership.organizationId,
    })
      .select('id', 'name', 'email')
      .first();

    if (!organization) {
      throw new BadRequestException('Organization not found');
    }

    const existingSubscription = await db.orm.public.BillingSubscription.where({
      organizationId: organization.id,
    })
      .select('status')
      .first();

    if (
      existingSubscription &&
      (existingSubscription.status === BillingSubscriptionStatus.ACTIVE ||
        existingSubscription.status === BillingSubscriptionStatus.TRIALING ||
        existingSubscription.status === BillingSubscriptionStatus.PAST_DUE)
    ) {
      throw new BadRequestException(
        'This organization already has a subscription',
      );
    }

    const priceId = this.getPriceId(plan, interval);

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

        billingInterval: interval,
      },

      subscription_data: {
        metadata: {
          organizationId: organization.id,

          billingPlan: plan,

          billingInterval: interval,
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

    const subscription = await db.orm.public.BillingSubscription.where({
      organizationId: membership.organizationId,
    })
      .select('stripeCustomerId')
      .first();

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

    const organization = await db.orm.public.Organization.where({
      id: organizationId,
    })
      .select('id')
      .first();

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

    const { plan, interval } = this.getPlanForPriceId(stripePriceId);

    const stripeCustomerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    /*
     * Stripe API v22 exposes billing-period timestamps on the
     * subscription item.
     */
    const currentPeriodStart =
      typeof item.current_period_start === 'number'
        ? toPrisma8Timestamp(new Date(item.current_period_start * 1000))
        : null;

    const currentPeriodEnd =
      typeof item.current_period_end === 'number'
        ? toPrisma8Timestamp(new Date(item.current_period_end * 1000))
        : null;

    const canceledAt =
      typeof subscription.canceled_at === 'number'
        ? toPrisma8Timestamp(new Date(subscription.canceled_at * 1000))
        : null;

    const trialEnd =
      typeof subscription.trial_end === 'number'
        ? toPrisma8Timestamp(new Date(subscription.trial_end * 1000))
        : null;

    const status = this.mapStripeSubscriptionStatus(subscription.status);

    const existing = await db.orm.public.BillingSubscription.where({
      organizationId,
    })
      .select('id')
      .first();

    const updateExisting = async (id: string) => {
      await db.orm.public.BillingSubscription.where({
        id,
      }).update({
        plan,
        interval,
        status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        trialEnd,
        updatedAt: toPrisma8Timestamp(),
      });
    };

    if (existing) {
      await updateExisting(existing.id);

      return;
    }

    const now = toPrisma8Timestamp();

    try {
      await db.orm.public.BillingSubscription.create({
        organizationId,
        plan,
        interval,
        status,
        stripeCustomerId,
        stripeSubscriptionId: subscription.id,
        stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt,
        trialEnd,
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      /*
       * Preserve Prisma 7 upsert race safety.
       *
       * The create is a standalone operation, so after a unique
       * violation it is safe to perform a fresh read and update.
       */
      if (!isPrisma8UniqueViolation(error)) {
        throw error;
      }

      const concurrent = await db.orm.public.BillingSubscription.where({
        organizationId,
      })
        .select('id')
        .first();

      if (!concurrent) {
        throw error;
      }

      await updateExisting(concurrent.id);
    }
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

  private getPlanForPriceId(priceId: string): {
    plan: BillingPlan;
    interval: BillingInterval;
  } {
    for (const entry of BILLING_PRICE_CATALOG) {
      const configuredPriceId = this.configService.get(entry.environmentKey, {
        infer: true,
      });

      if (configuredPriceId && configuredPriceId === priceId) {
        return {
          plan: entry.plan,
          interval: entry.interval,
        };
      }
    }

    throw new BadRequestException(
      'Stripe subscription uses an unknown ContractFlow price',
    );
  }

  private getPriceId(plan: BillingPlan, interval: BillingInterval): string {
    const catalogEntry = BILLING_PRICE_CATALOG.find(
      (entry) => entry.plan === plan && entry.interval === interval,
    );

    if (!catalogEntry) {
      throw new BadRequestException(
        `Unsupported ContractFlow billing selection: ${plan}/${interval}`,
      );
    }

    const priceId = this.configService.get(catalogEntry.environmentKey, {
      infer: true,
    });

    if (!priceId) {
      throw new ServiceUnavailableException(
        `Stripe billing is not configured for the ${plan} ${interval} plan`,
      );
    }

    return priceId;
  }
}
