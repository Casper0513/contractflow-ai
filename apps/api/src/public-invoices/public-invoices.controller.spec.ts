import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../config/environment';

jest.mock('../payments/stripe-payment.service', () => ({
  StripePaymentService: class StripePaymentService {},
}));

jest.mock('./public-invoices.service', () => ({
  PublicInvoicesService: class PublicInvoicesService {},
}));

import { StripePaymentService } from '../payments/stripe-payment.service';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';

describe('PublicInvoicesController', () => {
  const publicInvoicesService = {
    getPdfByToken: jest.fn(),
    getByToken: jest.fn(),
  };

  const stripePaymentService = {
    createCheckoutForPublicInvoice: jest.fn(),
  };

  const configService = {
    get: jest.fn((key: keyof Environment) => {
      if (key === 'WEB_URL') {
        return 'https://app.contractflowops.com';
      }

      throw new Error(`Unexpected config key: ${String(key)}`);
    }),
  };

  let controller: PublicInvoicesController;

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new PublicInvoicesController(
      publicInvoicesService as unknown as PublicInvoicesService,
      stripePaymentService as unknown as StripePaymentService,
      configService as unknown as ConfigService<Environment, true>,
    );
  });

  it('allows checkout from the configured web origin', async () => {
    stripePaymentService.createCheckoutForPublicInvoice.mockResolvedValue({
      url: 'https://checkout.stripe.com/example',
    });

    await expect(
      controller.createCheckout(
        'public-token',
        'https://app.contractflowops.com',
      ),
    ).resolves.toEqual({
      url: 'https://checkout.stripe.com/example',
    });

    expect(
      stripePaymentService.createCheckoutForPublicInvoice,
    ).toHaveBeenCalledWith('public-token');
  });

  it('rejects checkout when the Origin header is missing', () => {
    expect(() => controller.createCheckout('public-token', undefined)).toThrow(
      ForbiddenException,
    );

    expect(
      stripePaymentService.createCheckoutForPublicInvoice,
    ).not.toHaveBeenCalled();
  });

  it('rejects checkout from a foreign origin', () => {
    expect(() =>
      controller.createCheckout('public-token', 'https://attacker.example'),
    ).toThrow(ForbiddenException);

    expect(
      stripePaymentService.createCheckoutForPublicInvoice,
    ).not.toHaveBeenCalled();
  });

  it('rejects a malformed Origin header', () => {
    expect(() =>
      controller.createCheckout('public-token', 'not-a-valid-origin'),
    ).toThrow(ForbiddenException);

    expect(
      stripePaymentService.createCheckoutForPublicInvoice,
    ).not.toHaveBeenCalled();
  });

  it('does not require an origin to view a public invoice', async () => {
    publicInvoicesService.getByToken.mockResolvedValue({
      id: 'invoice_1',
    });

    await expect(controller.getByToken('public-token')).resolves.toEqual({
      id: 'invoice_1',
    });
  });
});
