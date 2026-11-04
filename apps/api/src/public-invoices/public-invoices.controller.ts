import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { StripePaymentService } from '../payments/stripe-payment.service';
import { PublicInvoicesService } from './public-invoices.service';

@UseGuards(ThrottlerGuard)
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(
    private readonly publicInvoicesService: PublicInvoicesService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/checkout')
  createCheckout(
    @Param('token')
    token: string,
  ) {
    return this.stripePaymentService.createCheckoutForPublicInvoice(token);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token/pdf')
  async downloadPdf(
    @Param('token')
    token: string,
  ) {
    const result = await this.publicInvoicesService.getPdfByToken(token);

    return new StreamableFile(result.buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${result.filename}"`,
      length: result.buffer.length,
    });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicInvoicesService.getByToken(token);
  }
}
