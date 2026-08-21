import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { JobCostsController } from './job-costs.controller';
import { JobCostsService } from './job-costs.service';

@Module({
  imports: [ActivityModule],
  controllers: [JobCostsController],
  providers: [JobCostsService],
  exports: [JobCostsService],
})
export class JobCostsModule {}
