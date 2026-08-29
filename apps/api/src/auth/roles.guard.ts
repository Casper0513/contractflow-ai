import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma, type OrganizationRole } from '@contractflow/db';
import type { Request } from 'express';

import type { AuthenticatedUser } from './authenticated-user';
import { ORGANIZATION_ROLES_KEY } from './roles.decorator';

type AuthenticatedRequest = Request & {
  authUser?: AuthenticatedUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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

    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId: request.authUser.clerkUserId,
        },
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('No organization membership found');
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
