import { Injectable } from '@nestjs/common';
import { db } from '@contractflow/db-prisma8';

import {
  BillingEntitlement,
  type BillingAccessState,
  getBillingEntitlements,
  hasBillingEntitlement,
  hasSubscriptionAccess,
} from './billing-entitlement.policy';

@Injectable()
export class BillingEntitlementService {
  async getAccessStateForOrganization(
    organizationId: string,
  ): Promise<BillingAccessState | null> {
    const subscription = await db.orm.public.BillingSubscription.where({
      organizationId,
    })
      .select('plan', 'status')
      .first();

    if (!subscription) {
      return null;
    }

    return {
      plan: subscription.plan,
      status: subscription.status,
    };
  }

  async hasSubscriptionAccessForOrganization(
    organizationId: string,
  ): Promise<boolean> {
    const subscription =
      await this.getAccessStateForOrganization(organizationId);

    return hasSubscriptionAccess(subscription);
  }

  async hasEntitlementForOrganization(
    organizationId: string,
    entitlement: BillingEntitlement,
  ): Promise<boolean> {
    const subscription =
      await this.getAccessStateForOrganization(organizationId);

    return hasBillingEntitlement(subscription, entitlement);
  }

  async getEntitlementsForOrganization(
    organizationId: string,
  ): Promise<BillingEntitlement[]> {
    const subscription =
      await this.getAccessStateForOrganization(organizationId);

    return getBillingEntitlements(subscription);
  }
}
