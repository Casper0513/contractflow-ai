import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { BillingEntitlementGuard } from '../billing/billing-entitlement.guard';
import { BillingEntitlement } from '../billing/billing-entitlement.policy';
import { RequiresBillingEntitlement } from '../billing/requires-billing-entitlement.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(ClerkAuthGuard, BillingEntitlementGuard)
@RequiresBillingEntitlement(BillingEntitlement.CORE_OPERATIONS)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() authUser: AuthenticatedUser) {
    return this.dashboardService.getForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }
}
