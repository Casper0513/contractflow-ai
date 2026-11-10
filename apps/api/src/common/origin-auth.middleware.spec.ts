import type { NextFunction, Request, Response } from 'express';

import {
  createOriginAuthMiddleware,
  ORIGIN_AUTH_HEADER,
} from './origin-auth.middleware';

type MockResponse = Response & {
  status: jest.Mock;
  json: jest.Mock;
};

function createRequest(path: string, originSecret?: string): Request {
  return {
    path,
    header: jest.fn((name: string) =>
      name.toLowerCase() === ORIGIN_AUTH_HEADER ? originSecret : undefined,
    ),
  } as unknown as Request;
}

function createResponse(): MockResponse {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as MockResponse;

  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);

  return response;
}

describe('createOriginAuthMiddleware', () => {
  const expectedSecret = 'contractflow-origin-auth-test-secret-0123456789';

  it('allows requests when origin authentication is not configured', () => {
    const middleware = createOriginAuthMiddleware();
    const request = createRequest('/api/jobs');
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status.mock.calls).toHaveLength(0);
  });

  it('allows the health endpoint without the origin header', () => {
    const middleware = createOriginAuthMiddleware(expectedSecret);
    const request = createRequest('/api/health');
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status.mock.calls).toHaveLength(0);
  });

  it.each([
    '/api/auth/clerk/webhook',
    '/api/payments/stripe/webhook',
    '/api/billing/stripe/webhook',
  ])(
    'allows verified provider webhook path %s without the origin header',
    (path) => {
      const middleware = createOriginAuthMiddleware(expectedSecret);
      const request = createRequest(path);
      const response = createResponse();
      const next = jest.fn() as NextFunction;

      middleware(request, response, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(response.status.mock.calls).toHaveLength(0);
    },
  );

  it('allows a request with the correct origin secret', () => {
    const middleware = createOriginAuthMiddleware(expectedSecret);
    const request = createRequest('/api/jobs', expectedSecret);
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status.mock.calls).toHaveLength(0);
  });

  it('rejects a request without the origin secret', () => {
    const middleware = createOriginAuthMiddleware(expectedSecret);
    const request = createRequest('/api/jobs');
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status.mock.calls).toEqual([[403]]);
    expect(response.json.mock.calls).toEqual([
      [
        {
          statusCode: 403,
          message: 'Forbidden',
        },
      ],
    ]);
  });

  it('rejects a request with an incorrect origin secret', () => {
    const middleware = createOriginAuthMiddleware(expectedSecret);
    const request = createRequest(
      '/api/jobs',
      'incorrect-origin-auth-secret-0123456789',
    );
    const response = createResponse();
    const next = jest.fn() as NextFunction;

    middleware(request, response, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status.mock.calls).toEqual([[403]]);
  });
});
