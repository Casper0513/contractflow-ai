import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BillingService } from './billing.service';
import { CreateBillingCheckoutDto } from './dto/create-billing-checkout.dto';

@Controller('billing')
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get()
  getBilling(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.billingService.getForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }

  @Post('checkout')
  createCheckout(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateBillingCheckoutDto,
  ) {
    return this.billingService.createCheckoutForUser(
      authUser.clerkUserId,
      input.plan,
      input.interval,
      authUser.activeOrganizationId,
    );
  }

  @Post('portal')
  createPortal(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.billingService.createPortalForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }
}
