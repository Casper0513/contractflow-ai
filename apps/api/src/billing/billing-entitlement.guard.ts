import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { BillingEntitlement } from './billing-entitlement.policy';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BILLING_ENTITLEMENT_KEY } from './requires-billing-entitlement.decorator';

type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUser;
};

@Injectable()
export class BillingEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationMemberships: OrganizationMembershipService,
    private readonly billingEntitlements: BillingEntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredEntitlement =
      this.reflector.getAllAndOverride<BillingEntitlement>(
        BILLING_ENTITLEMENT_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (!requiredEntitlement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new UnauthorizedException(
        'Billing entitlement requires an authenticated user',
      );
    }

    let membership;

    try {
      membership = await this.organizationMemberships.resolveForUser(
        request.authUser.clerkUserId,
        request.authUser.activeOrganizationId,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new ForbiddenException('No organization membership found');
      }

      throw error;
    }

    const allowed =
      await this.billingEntitlements.hasEntitlementForOrganization(
        membership.organizationId,
        requiredEntitlement,
      );

    if (!allowed) {
      throw new ForbiddenException(
        'Your ContractFlow subscription does not include this feature',
      );
    }

    return true;
  }
}
