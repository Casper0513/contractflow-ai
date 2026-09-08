import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthModule, BillingModule, EmailModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
