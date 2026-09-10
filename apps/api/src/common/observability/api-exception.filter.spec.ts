import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { AbstractHttpAdapter } from '@nestjs/core';

jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

import * as Sentry from '@sentry/nestjs';

import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const request = {
    method: 'GET',
    originalUrl: '/api/example?secret=DO_NOT_LOG',
    path: '/api/example',
    requestId: 'request-123',
  };

  function createHost(): ArgumentsHost {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
      switchToRpc: () => {
        throw new Error('not used');
      },
      switchToWs: () => {
        throw new Error('not used');
      },
      getArgs: () => [],
      getArgByIndex: () => undefined,
      getType: () => 'http',
    } as unknown as ArgumentsHost;
  }

  function createFilter() {
    const httpAdapter = {
      reply: jest.fn(),
      isHeadersSent: jest.fn().mockReturnValue(false),
    } as unknown as AbstractHttpAdapter;

    return {
      filter: new ApiExceptionFilter(httpAdapter),
      httpAdapter,
    };
  }

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('logs a correlated sanitized record for a 5xx exception', () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const { filter } = createFilter();

    filter.catch(
      new InternalServerErrorException('provider unavailable'),
      createHost(),
    );

    expect(log).toHaveBeenCalledTimes(1);

    const message = String(log.mock.calls[0]?.[0]);

    expect(message).toContain('"event":"http_request_failed"');
    expect(message).toContain('"requestId":"request-123"');
    expect(message).toContain('"method":"GET"');
    expect(message).toContain('"path":"/api/example"');
    expect(message).toContain('"statusCode":500');
    expect(message).not.toContain('DO_NOT_LOG');

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    const sentryCall = (
      Sentry.captureException as jest.MockedFunction<
        typeof Sentry.captureException
      >
    ).mock.calls[0];

    expect(sentryCall).toBeDefined();

    const [capturedException, captureContext] = sentryCall;

    expect(capturedException).toBeInstanceOf(InternalServerErrorException);

    expect(captureContext).toEqual({
      tags: {
        requestId: 'request-123',
        httpMethod: 'GET',
        httpStatusCode: '500',
      },
      contexts: {
        contractflowHttp: {
          path: '/api/example',
        },
      },
    });

    expect(JSON.stringify(captureContext)).not.toContain('DO_NOT_LOG');
  });

  it('does not duplicate-log expected 4xx exceptions', () => {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const { filter } = createFilter();

    filter.catch(new BadRequestException('invalid input'), createHost());

    expect(log).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
