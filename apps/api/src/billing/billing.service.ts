import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingPlan, Prisma, prisma } from '@contractflow/db';
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
