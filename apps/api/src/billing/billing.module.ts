import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingAccessController } from './billing-access.controller';
import { BillingController } from './billing.controller';
import { BillingEntitlementGuard } from './billing-entitlement.guard';
import { BillingEntitlementService } from './billing-entitlement.service';
import { BillingStripeWebhookController } from './billing-stripe-webhook.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule],
  controllers: [
    BillingAccessController,
    BillingController,
    BillingStripeWebhookController,
  ],
  providers: [
    BillingService,
    BillingEntitlementService,
    BillingEntitlementGuard,
  ],
  exports: [BillingService, BillingEntitlementService, BillingEntitlementGuard],
})
export class BillingModule {}
