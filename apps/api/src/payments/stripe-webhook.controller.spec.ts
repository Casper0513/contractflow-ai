import { BadRequestException } from '@nestjs/common';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type Stripe from 'stripe';

jest.mock('./stripe-payment.service', () => ({
  StripePaymentService: class StripePaymentService {},
}));

import { StripePaymentService } from './stripe-payment.service';
import { StripeWebhookController } from './stripe-webhook.controller';

function createRequest(rawBody?: Buffer): RawBodyRequest<Request> {
  return {
    rawBody,
  } as unknown as RawBodyRequest<Request>;
}

describe('StripeWebhookController', () => {
  const constructWebhookEvent = jest.fn();
  const handleWebhookEvent = jest.fn();

  let controller: StripeWebhookController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new StripeWebhookController({
      constructWebhookEvent,
      handleWebhookEvent,
    } as unknown as StripePaymentService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a request without a Stripe signature', async () => {
    await expect(
      controller.webhook(createRequest(Buffer.from('{}')), undefined),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects a request without a raw body', async () => {
    await expect(
      controller.webhook(createRequest(), 'signature'),
    ).rejects.toThrow('Stripe webhook raw body is unavailable');

    expect(constructWebhookEvent).not.toHaveBeenCalled();
  });

  it('sanitizes logs when Stripe signature verification fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    constructWebhookEvent.mockImplementation(() => {
      throw new Error(
        'No signatures found matching the expected signature for payload',
      );
    });

    try {
      await expect(
        controller.webhook(
          createRequest(Buffer.from('{"id":"evt_sensitive"}')),
          'sensitive_signature_value',
        ),
      ).rejects.toThrow('Invalid Stripe webhook signature');

      expect(consoleError).toHaveBeenCalledWith(
        'Stripe webhook signature verification failed',
      );

      const logged = consoleError.mock.calls.flat().join(' ');

      expect(logged).not.toContain(
        'No signatures found matching the expected signature for payload',
      );
      expect(logged).not.toContain('sensitive_signature_value');
      expect(logged).not.toContain('evt_sensitive');

      expect(handleWebhookEvent).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('forwards a valid verified webhook event', async () => {
    const event = {
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {},
      },
    } as unknown as Stripe.Event;

    constructWebhookEvent.mockReturnValue(event);
    handleWebhookEvent.mockResolvedValue(undefined);

    const rawBody = Buffer.from('{"id":"evt_1"}');

    await expect(
      controller.webhook(
        rawBody ? createRequest(rawBody) : createRequest(),
        'signature',
      ),
    ).resolves.toEqual({
      received: true,
    });

    expect(constructWebhookEvent).toHaveBeenCalledWith(rawBody, 'signature');

    expect(handleWebhookEvent).toHaveBeenCalledWith(event);
  });
});
