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

    /*
     * Clerk authenticateRequest expects a standard Web Request.
     * Construct one using the incoming Nest/Express request headers.
     */
    const protocol = request.protocol || 'http';
    const host = request.get('host') || 'localhost:4000';
    const url = `${protocol}://${host}${request.originalUrl}`;

    const webRequest = new Request(url, {
      method: request.method,
      headers: new Headers({
        authorization,
        accept: request.headers.accept ?? 'application/json',
        origin: request.headers.origin ?? 'http://localhost:3000',
      }),
    });

    try {
      const authState = await clerkClient.authenticateRequest(webRequest, {
        acceptsToken: 'session_token',
      });

      if (!authState.isAuthenticated) {
        this.logger.error(
          `Clerk authentication failed: ${authState.reason ?? 'unknown reason'}`,
        );

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
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Clerk request authentication failed: ${message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired session');
    }
  }
}
