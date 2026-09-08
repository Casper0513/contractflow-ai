import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingEntitlementGuard } from '../billing/billing-entitlement.guard';
import { BillingEntitlement } from '../billing/billing-entitlement.policy';
import { RequiresBillingEntitlement } from '../billing/requires-billing-entitlement.decorator';
import { TeamMembersService } from './team-members.service';

@Controller('team-members')
@UseGuards(ClerkAuthGuard, BillingEntitlementGuard)
@RequiresBillingEntitlement(BillingEntitlement.CORE_OPERATIONS)
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.teamMembersService.listForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }
}
