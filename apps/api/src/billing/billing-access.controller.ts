import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { BillingEntitlementService } from './billing-entitlement.service';

@Controller('billing/access')
@UseGuards(ClerkAuthGuard)
export class BillingAccessController {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
    private readonly billingEntitlements: BillingEntitlementService,
  ) {}

  @Get()
  async getAccess(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    const membership = await this.organizationMemberships.resolveForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );

    const accessState =
      await this.billingEntitlements.getAccessStateForOrganization(
        membership.organizationId,
      );

    const [hasAccess, entitlements] = await Promise.all([
      this.billingEntitlements.hasSubscriptionAccessForOrganization(
        membership.organizationId,
      ),
      this.billingEntitlements.getEntitlementsForOrganization(
        membership.organizationId,
      ),
    ]);

    return {
      organizationId: membership.organizationId,
      hasAccess,
      plan: accessState?.plan ?? null,
      status: accessState?.status ?? null,
      entitlements,
    };
  }
}
