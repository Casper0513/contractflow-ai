import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

const mockVerifyWebhook = jest.fn();

jest.mock('@clerk/backend/webhooks', () => ({
  verifyWebhook: mockVerifyWebhook,
}));

jest.mock('./auth.service', () => ({
  AuthService: class AuthService {},
}));

import { ClerkWebhookController } from './clerk-webhook.controller';

function createConfigService(signingSecret: string | undefined) {
  return {
    get: jest.fn((key: string) => {
      if (key === 'CLERK_WEBHOOK_SIGNING_SECRET') {
        return signingSecret;
      }

      return undefined;
    }),
  };
}

function createRequest(rawBody?: Buffer): RawBodyRequest<Request> {
  return {
    rawBody,
    protocol: 'http',
    originalUrl: '/api/auth/clerk/webhook',
    headers: {
      host: 'localhost:4000',
      'svix-id': 'msg_1',
      'svix-timestamp': '1234567890',
      'svix-signature': 'v1,test',
      'content-type': 'application/json',
    },
    get: jest.fn((name: string) => {
      if (name.toLowerCase() === 'host') {
        return 'localhost:4000';
      }

      return undefined;
    }),
  } as unknown as RawBodyRequest<Request>;
}

function createController(
  signingSecret: string | undefined = 'whsec_test_contractflow',
) {
  const handleClerkUserDeleted = jest.fn();

  const controller = new ClerkWebhookController(
    createConfigService(signingSecret) as never,
    {
      handleClerkUserDeleted,
    } as never,
  );

  return {
    controller,
    handleClerkUserDeleted,
  };
}

describe('ClerkWebhookController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a webhook when the raw body is unavailable', async () => {
    const { controller } = createController();

    await expect(controller.webhook(createRequest())).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockVerifyWebhook).not.toHaveBeenCalled();
  });

  it('fails closed when the Clerk webhook signing secret is not configured', async () => {
    const { controller } = createController('');

    await expect(
      controller.webhook(createRequest(Buffer.from('{}'))),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(mockVerifyWebhook).not.toHaveBeenCalled();
  });

  it('rejects an invalid Clerk webhook signature', async () => {
    const { controller } = createController();

    mockVerifyWebhook.mockRejectedValue(new Error('invalid webhook signature'));

    await expect(
      controller.webhook(createRequest(Buffer.from('{}'))),
    ).rejects.toThrow('Invalid Clerk webhook signature');
  });

  it('rejects a deleted-user event without a user ID', async () => {
    const { controller, handleClerkUserDeleted } = createController();

    mockVerifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      data: {},
    });

    await expect(
      controller.webhook(createRequest(Buffer.from('{}'))),
    ).rejects.toThrow('Clerk deleted-user webhook is missing a user ID');

    expect(handleClerkUserDeleted).not.toHaveBeenCalled();
  });

  it('forwards a verified user.deleted event to AuthService', async () => {
    const { controller, handleClerkUserDeleted } = createController();

    mockVerifyWebhook.mockResolvedValue({
      type: 'user.deleted',
      data: {
        id: 'clerk_user_1',
      },
    });

    handleClerkUserDeleted.mockResolvedValue({
      success: true,
      deleted: true,
      finalOwnerConflict: false,
    });

    await expect(
      controller.webhook(createRequest(Buffer.from('{"type":"user.deleted"}'))),
    ).resolves.toEqual({
      received: true,
    });

    expect(mockVerifyWebhook).toHaveBeenCalledTimes(1);

    expect(handleClerkUserDeleted).toHaveBeenCalledWith('clerk_user_1');
  });

  it('acknowledges unrelated verified Clerk events without deleting a user', async () => {
    const { controller, handleClerkUserDeleted } = createController();

    mockVerifyWebhook.mockResolvedValue({
      type: 'user.created',
      data: {
        id: 'clerk_user_1',
      },
    });

    await expect(
      controller.webhook(createRequest(Buffer.from('{"type":"user.created"}'))),
    ).resolves.toEqual({
      received: true,
    });

    expect(handleClerkUserDeleted).not.toHaveBeenCalled();
  });
});
