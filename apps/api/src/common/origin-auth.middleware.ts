import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const ORIGIN_AUTH_HEADER = 'x-contractflow-origin-auth';

const ORIGIN_AUTH_EXEMPT_PATHS = new Set([
  '/api/health',
  '/api/auth/clerk/webhook',
  '/api/payments/stripe/webhook',
  '/api/billing/stripe/webhook',
]);

function secretsMatch(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);

  if (expectedBuffer.length !== suppliedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export function createOriginAuthMiddleware(expectedSecret?: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    /*
     * Staged rollout:
     * Origin authentication is disabled until ORIGIN_AUTH_SECRET exists.
     */
    if (!expectedSecret) {
      next();
      return;
    }

    /*
     * Infrastructure health checks and verified third-party webhooks must be
     * reachable without ContractFlow's private origin header.
     *
     * Each webhook controller performs its own provider signature
     * verification before processing the event.
     */
    if (ORIGIN_AUTH_EXEMPT_PATHS.has(request.path)) {
      next();
      return;
    }

    const suppliedSecret = request.header(ORIGIN_AUTH_HEADER)?.trim();

    if (!suppliedSecret || !secretsMatch(expectedSecret, suppliedSecret)) {
      response.status(403).json({
        statusCode: 403,
        message: 'Forbidden',
      });
      return;
    }

    next();
  };
}
