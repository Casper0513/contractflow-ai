import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

import type { Environment } from '../config/environment';
import { BillingStripeWebhookController } from './billing-stripe-webhook.controller';
import { BillingService } from './billing.service';

function createConfigService(
  billingWebhookSecret: string | undefined,
): ConfigService<Environment, true> {
  return {
    get: jest.fn((key: keyof Environment) => {
      switch (key) {
        case 'STRIPE_SECRET_KEY':
          return 'sk_test_contractflow';

        case 'STRIPE_BILLING_WEBHOOK_SECRET':
          return billingWebhookSecret;

        default:
          return undefined;
      }
    }),
  } as unknown as ConfigService<Environment, true>;
}

function createRequest(rawBody?: Buffer): RawBodyRequest<Request> {
  return {
    rawBody,
  } as unknown as RawBodyRequest<Request>;
}

describe('BillingStripeWebhookController', () => {
  let handleStripeWebhookEvent: jest.Mock<Promise<void>, [Stripe.Event]>;

  let billingService: BillingService;

  beforeEach(() => {
    jest.restoreAllMocks();

    handleStripeWebhookEvent = jest.fn<Promise<void>, [Stripe.Event]>();

    billingService = {
      handleStripeWebhookEvent: (event: Stripe.Event) =>
        handleStripeWebhookEvent(event),
    } as unknown as BillingService;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a request without a Stripe signature', async () => {
    const controller = new BillingStripeWebhookController(
      createConfigService('whsec_billing_test'),
      billingService,
    );

    await expect(
      controller.webhook(createRequest(Buffer.from('{}')), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a request without a raw body', async () => {
    const controller = new BillingStripeWebhookController(
      createConfigService('whsec_billing_test'),
      billingService,
    );

    await expect(
      controller.webhook(createRequest(), 'signature'),
    ).rejects.toThrow('Stripe billing webhook raw body is unavailable');
  });

  it('fails closed when the billing webhook secret is not configured', async () => {
    const controller = new BillingStripeWebhookController(
      createConfigService(undefined),
      billingService,
    );

    await expect(
      controller.webhook(createRequest(Buffer.from('{}')), 'signature'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects an invalid Stripe billing webhook signature', async () => {
    const controller = new BillingStripeWebhookController(
      createConfigService('whsec_billing_test'),
      billingService,
    );

    const stripe = (
      controller as unknown as {
        stripe: Stripe;
      }
    ).stripe;

    jest.spyOn(stripe.webhooks, 'constructEvent').mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(
      controller.webhook(createRequest(Buffer.from('{}')), 'bad_signature'),
    ).rejects.toThrow('Invalid Stripe billing webhook signature');

    expect(handleStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it('verifies and forwards a valid billing webhook event', async () => {
    const controller = new BillingStripeWebhookController(
      createConfigService('whsec_billing_test'),
      billingService,
    );

    const stripe = (
      controller as unknown as {
        stripe: Stripe;
      }
    ).stripe;

    const event = {
      id: 'evt_1',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {},
      },
    } as unknown as Stripe.Event;

    const constructEvent = jest
      .spyOn(stripe.webhooks, 'constructEvent')
      .mockReturnValue(event);

    handleStripeWebhookEvent.mockResolvedValue();

    const rawBody = Buffer.from('{"id":"evt_1"}');

    await expect(
      controller.webhook(createRequest(rawBody), 'valid_signature'),
    ).resolves.toEqual({
      received: true,
    });

    expect(constructEvent).toHaveBeenCalledWith(
      rawBody,
      'valid_signature',
      'whsec_billing_test',
    );

    expect(handleStripeWebhookEvent).toHaveBeenCalledWith(event);
  });
});
