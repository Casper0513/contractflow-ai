import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { StripePaymentService } from './stripe-payment.service';

@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(private readonly stripePaymentService: StripePaymentService) {}

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
      throw new BadRequestException('Stripe webhook raw body is unavailable');
    }

    let event;

    try {
      event = this.stripePaymentService.constructWebhookEvent(
        request.rawBody,
        signature,
      );
    } catch (error) {
      console.error('Stripe webhook signature verification failed', error);

      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    await this.stripePaymentService.handleWebhookEvent(event);

    return {
      received: true,
    };
  }
}
