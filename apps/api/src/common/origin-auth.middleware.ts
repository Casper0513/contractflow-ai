import { timingSafeEqual } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

export const ORIGIN_AUTH_HEADER = 'x-contractflow-origin-auth';

const HEALTH_PATH = '/api/health';

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
     * Railway must be able to probe the API directly.
     */
    if (request.path === HEALTH_PATH) {
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
