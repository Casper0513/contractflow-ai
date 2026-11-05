import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import type { Request as ExpressRequest } from 'express';

import type { Environment } from '../config/environment';
import type { AuthenticatedUser } from './authenticated-user';

type AuthenticatedRequest = ExpressRequest & {
  authUser?: AuthenticatedUser;
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);

  constructor(
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const clerkClient = createClerkClient({
      publishableKey: this.configService.get('CLERK_PUBLISHABLE_KEY', {
        infer: true,
      }),
      secretKey: this.configService.get('CLERK_SECRET_KEY', { infer: true }),
    });

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    const authorizedParty = new URL(webUrl).origin;

    /*
     * Clerk authenticateRequest expects a standard Web Request.
     * Construct one using only the headers required for authentication.
     */
    const protocol = request.protocol || 'http';
    const host = request.get('host') || 'localhost:4000';
    const url = `${protocol}://${host}${request.originalUrl}`;

    const webRequest = new Request(url, {
      method: request.method,
      headers: new Headers({
        authorization,
        accept: request.headers.accept ?? 'application/json',
        origin: request.headers.origin ?? authorizedParty,
      }),
    });

    try {
      const authState = await clerkClient.authenticateRequest(webRequest, {
        acceptsToken: 'session_token',
        authorizedParties: [authorizedParty],
      });

      if (!authState.isAuthenticated) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      const auth = authState.toAuth();

      if (!auth.userId) {
        throw new UnauthorizedException('Authenticated token has no user ID');
      }

      const requestedOrganizationId = request.get('x-organization-id')?.trim();

      request.authUser = {
        clerkUserId: auth.userId,
        sessionId: auth.sessionId ?? undefined,
        activeOrganizationId: requestedOrganizationId || undefined,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      /*
       * Do not log Clerk-provided exception messages here. Authentication
       * errors may contain implementation details that should not enter
       * application logs.
       */
      this.logger.error('Clerk request authentication failed');

      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
