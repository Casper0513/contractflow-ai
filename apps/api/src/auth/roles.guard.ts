import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { OrganizationRole } from '@contractflow/db';
import type { Request } from 'express';

import type { AuthenticatedUser } from './authenticated-user';
import { OrganizationMembershipService } from './organization-membership.service';
import { ORGANIZATION_ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORGANIZATION_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authUser) {
      throw new UnauthorizedException(
        'Authorization requires an authenticated user',
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

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
