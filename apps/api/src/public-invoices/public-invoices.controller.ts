import { Controller, Get, Param, Post, StreamableFile } from '@nestjs/common';

import { StripePaymentService } from '../payments/stripe-payment.service';
import { PublicInvoicesService } from './public-invoices.service';

@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(
    private readonly publicInvoicesService: PublicInvoicesService,
    private readonly stripePaymentService: StripePaymentService,
  ) {}

  @Post(':token/checkout')
  createCheckout(
    @Param('token')
    token: string,
  ) {
    return this.stripePaymentService.createCheckoutForPublicInvoice(token);
  }

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

  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicInvoicesService.getByToken(token);
  }
}
