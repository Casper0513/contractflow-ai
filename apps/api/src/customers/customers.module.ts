import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
