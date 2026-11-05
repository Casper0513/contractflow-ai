import {
  ExecutionContext,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';

import type { Environment } from '../config/environment';
import { ClerkAuthGuard } from './clerk-auth.guard';

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(),
}));

const mockedCreateClerkClient = jest.mocked(createClerkClient);

describe('ClerkAuthGuard', () => {
  const authenticateRequest = jest.fn();

  const configService = {
    get: jest.fn((key: keyof Environment) => {
      switch (key) {
        case 'CLERK_PUBLISHABLE_KEY':
          return 'pk_test_example';
        case 'CLERK_SECRET_KEY':
          return 'sk_test_example';
        case 'WEB_URL':
          return 'https://app.contractflowops.com/';
        default:
          throw new Error(`Unexpected config key: ${String(key)}`);
      }
    }),
  };

  let guard: ClerkAuthGuard;

  beforeEach(() => {
    jest.clearAllMocks();

    mockedCreateClerkClient.mockReturnValue({
      authenticateRequest,
    } as unknown as ReturnType<typeof createClerkClient>);

    guard = new ClerkAuthGuard(
      configService as unknown as ConfigService<Environment, true>,
    );
  });

  function createContext(options?: {
    authorization?: string;
    origin?: string;
  }): ExecutionContext {
    const headers: Record<string, string | undefined> = {
      authorization: options?.authorization,
      accept: 'application/json',
      origin: options?.origin,
    };

    const request = {
      headers,
      protocol: 'https',
      method: 'GET',
      originalUrl: '/api/customers',
      get(name: string) {
        const normalized = name.toLowerCase();

        if (normalized === 'host') {
          return 'api.contractflowops.com';
        }

        return headers[normalized];
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('rejects requests without a bearer token', async () => {
    await expect(guard.canActivate(createContext())).rejects.toThrow(
      UnauthorizedException,
    );

    expect(mockedCreateClerkClient).not.toHaveBeenCalled();
  });

  it('passes the configured web origin as an authorized party', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({
        userId: 'user_1',
        sessionId: 'sess_1',
      }),
    });

    await expect(
      guard.canActivate(
        createContext({
          authorization: 'Bearer test-session-token',
          origin: 'https://app.contractflowops.com',
        }),
      ),
    ).resolves.toBe(true);

    expect(authenticateRequest).toHaveBeenCalledTimes(1);

    const call = authenticateRequest.mock.calls[0] as unknown as [
      Request,
      {
        acceptsToken: 'session_token';
        authorizedParties: string[];
      },
    ];

    expect(call[1]).toEqual(
      expect.objectContaining({
        acceptsToken: 'session_token',
        authorizedParties: ['https://app.contractflowops.com'],
      }),
    );
  });

  it('rejects an unauthenticated Clerk result', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: false,
      reason: 'token-invalid',
    });

    await expect(
      guard.canActivate(
        createContext({
          authorization: 'Bearer invalid-token',
        }),
      ),
    ).rejects.toThrow('Invalid or expired session');
  });

  it('logs only a generic message when Clerk throws unexpectedly', async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    authenticateRequest.mockRejectedValue(
      new Error('sensitive provider detail example'),
    );

    await expect(
      guard.canActivate(
        createContext({
          authorization: 'Bearer invalid-token',
        }),
      ),
    ).rejects.toThrow('Invalid or expired session');

    expect(loggerSpy).toHaveBeenCalledWith(
      'Clerk request authentication failed',
    );

    expect(loggerSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('sensitive provider detail example'),
    );

    loggerSpy.mockRestore();
  });
});
