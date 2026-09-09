import { randomUUID } from 'node:crypto';

import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const logger = new Logger('HTTP');

export type RequestWithId = Request & {
  requestId?: string;
};

export function requestObservabilityMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = process.hrtime.bigint();

  const suppliedRequestId = request.header(REQUEST_ID_HEADER)?.trim();

  const requestId =
    suppliedRequestId && SAFE_REQUEST_ID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

  (request as RequestWithId).requestId = requestId;

  response.setHeader(REQUEST_ID_HEADER, requestId);

  response.once('finish', () => {
    const elapsedNanoseconds = process.hrtime.bigint() - startedAt;

    const durationMs =
      Math.round((Number(elapsedNanoseconds) / 1_000_000) * 100) / 100;

    /*
     * Never log the query string here.
     *
     * Public estimate/invoice URLs and other endpoints may contain
     * customer-facing tokens or future sensitive query parameters.
     */
    const path = request.originalUrl.split('?', 1)[0] || request.path;

    const message = JSON.stringify({
      event: 'http_request_completed',
      requestId,
      method: request.method,
      path,
      statusCode: response.statusCode,
      durationMs,
    });

    if (response.statusCode >= 500) {
      logger.error(message);
      return;
    }

    if (response.statusCode >= 400) {
      logger.warn(message);
      return;
    }

    logger.log(message);
  });

  next();
}
