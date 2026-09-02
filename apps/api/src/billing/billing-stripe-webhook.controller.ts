import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';

import type { Environment } from '../config/environment';
import { BillingService } from './billing.service';

@Controller('billing/stripe')
export class BillingStripeWebhookController {
  private readonly stripe: Stripe;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly billingService: BillingService,
  ) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY', {
        infer: true,
      }),
    );
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Req()
    request: RawBodyRequest<Request>,

    @Headers('stripe-signature')
    signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!request.rawBody) {
      throw new BadRequestException(
        'Stripe billing webhook raw body is unavailable',
      );
    }

    const webhookSecret = this.configService.get(
      'STRIPE_BILLING_WEBHOOK_SECRET',
      {
        infer: true,
      },
    );

    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe billing webhook is not configured',
      );
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe billing webhook signature');
    }

    await this.billingService.handleStripeWebhookEvent(event);

    return {
      received: true,
    };
  }
}
