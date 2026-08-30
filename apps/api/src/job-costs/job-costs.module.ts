import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ActivityModule } from '../activity/activity.module';
import { JobCostsController } from './job-costs.controller';
import { JobCostsService } from './job-costs.service';

@Module({
  imports: [AuthModule, ActivityModule],
  controllers: [JobCostsController],
  providers: [JobCostsService],
  exports: [JobCostsService],
})
export class JobCostsModule {}
