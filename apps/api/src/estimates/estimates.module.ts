import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { EmailModule } from '../email/email.module';
import { EstimateDeliveryService } from './estimate-delivery.service';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';

@Module({
  imports: [ActivityModule, EmailModule],
  controllers: [EstimatesController],
  providers: [EstimatesService, EstimateDeliveryService],
  exports: [EstimatesService, EstimateDeliveryService],
})
export class EstimatesModule {}
