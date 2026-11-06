import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

import type { RequestWithId } from './request-observability.middleware';
import { sanitizeRequestPath } from './sanitize-request-path';

@Catch()
export class ApiExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('Exception');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();

    const request = http.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : 500;

    /*
     * Expected 4xx application errors are deliberately not duplicated here.
     *
     * The HTTP completion logger already records their status code.
     * This filter exists to surface production failures that need operator
     * attention.
     */
    if (statusCode >= 500) {
      const requestWithId = request as RequestWithId;

      /*
       * Never include the query string, headers, cookies, authorization,
       * request body, or public access tokens in exception logs.
       */
      const path = sanitizeRequestPath(request.originalUrl, request.path);

      this.logger.error(
        JSON.stringify({
          event: 'http_request_failed',
          requestId: requestWithId.requestId ?? null,
          method: request.method,
          path,
          statusCode,
          errorName: 'InternalServerError',
          errorMessage: 'Internal server error',
        }),
      );

      /*
       * Preserve useful stack frames without forwarding the original
       * exception message to Sentry.
       *
       * The first line of an Error stack contains its name and message, so
       * only the subsequent stack frames are retained.
       */
      const capturedException = createSanitizedException(exception);

      Sentry.captureException(capturedException, {
        tags: {
          requestId: requestWithId.requestId ?? 'unknown',
          httpMethod: request.method,
          httpStatusCode: String(statusCode),
        },
        contexts: {
          contractflowHttp: {
            path,
          },
        },
      });
    }

    /*
     * Delegate response construction to Nest.
     *
     * This intentionally preserves the existing HttpException response
     * payloads and Nest's standard 500 handling.
     */
    super.catch(exception, host);
  }
}

function createSanitizedException(exception: unknown): Error {
  const sanitized = new Error('Internal server error');

  sanitized.name = 'InternalServerError';

  if (exception instanceof Error && exception.stack) {
    const stackLines = exception.stack.split('\n').slice(1);

    sanitized.stack = [
      `${sanitized.name}: ${sanitized.message}`,
      ...stackLines,
    ].join('\n');
  }

  return sanitized;
}
