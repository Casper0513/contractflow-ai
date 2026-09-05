import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';

@Module({
  imports: [PaymentsModule],
  controllers: [PublicInvoicesController],
  providers: [PublicInvoicesService],
})
export class PublicInvoicesModule {}
