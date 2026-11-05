import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import type { Environment } from '../config/environment';
import { StripePaymentService } from '../payments/stripe-payment.service';
import { PublicInvoicesService } from './public-invoices.service';

@UseGuards(ThrottlerGuard)
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(
    private readonly publicInvoicesService: PublicInvoicesService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly configService: ConfigService<Environment, true>,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  @Post(':token/checkout')
  createCheckout(
    @Param('token')
    token: string,
    @Headers('origin')
    origin: string | undefined,
  ) {
    this.assertTrustedCheckoutOrigin(origin);

    return this.stripePaymentService.createCheckoutForPublicInvoice(token);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
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
  @Header('Cache-Control', 'no-store')
  @Get(':token')
  getByToken(
    @Param('token')
    token: string,
  ) {
    return this.publicInvoicesService.getByToken(token);
  }

  private assertTrustedCheckoutOrigin(origin: string | undefined): void {
    if (!origin) {
      throw new ForbiddenException('Checkout request origin is not allowed');
    }

    const webUrl = this.configService.get('WEB_URL', {
      infer: true,
    });

    let requestOrigin: string;

    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      throw new ForbiddenException('Checkout request origin is not allowed');
    }

    const trustedOrigin = new URL(webUrl).origin;

    if (requestOrigin !== trustedOrigin) {
      throw new ForbiddenException('Checkout request origin is not allowed');
    }
  }
}
