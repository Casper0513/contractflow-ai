import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { EmailModule } from '../email/email.module';
import { EstimateDeliveryService } from './estimate-delivery.service';
import { EstimateExpirationScheduler } from './estimate-expiration.scheduler';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [ActivityModule, EmailModule],

  controllers: [EstimatesController],

  providers: [
    EstimatesService,
    EstimateDeliveryService,
    EstimateExpirationScheduler,
  ],

  exports: [EstimatesService, EstimateDeliveryService],
})
export class EstimatesModule {}
