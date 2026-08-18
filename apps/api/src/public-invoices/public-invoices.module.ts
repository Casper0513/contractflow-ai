import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { PaymentsModule } from '../payments/payments.module';
import { PublicInvoicesController } from './public-invoices.controller';
import { PublicInvoicesService } from './public-invoices.service';

@Module({
  imports: [ActivityModule, PaymentsModule],
  controllers: [PublicInvoicesController],
  providers: [PublicInvoicesService],
})
export class PublicInvoicesModule {}
