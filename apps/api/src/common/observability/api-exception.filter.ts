import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/nestjs';
import type { Request } from 'express';

import type { RequestWithId } from './request-observability.middleware';

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
      const path = request.originalUrl.split('?', 1)[0] || request.path;

      const error =
        exception instanceof Error
          ? {
              name: exception.name,
              message: exception.message,
            }
          : {
              name: 'UnknownException',
              message: 'Non-Error exception thrown',
            };

      this.logger.error(
        JSON.stringify({
          event: 'http_request_failed',
          requestId: requestWithId.requestId ?? null,
          method: request.method,
          path,
          statusCode,
          errorName: error.name,
          errorMessage: error.message,
        }),
      );

      /*
       * Capture only the sanitized operational context that ContractFlow
       * explicitly chooses to attach.
       *
       * Do not pass the Express request object to Sentry. In particular,
       * never attach request headers, cookies, authorization, body, query
       * string, or public access tokens here.
       */
      const capturedException =
        exception instanceof Error
          ? exception
          : new Error('Non-Error exception thrown');

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
