import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { PublicEstimatesController } from './public-estimates.controller';
import { PublicEstimatesService } from './public-estimates.service';

@Module({
  imports: [ActivityModule],
  controllers: [PublicEstimatesController],
  providers: [PublicEstimatesService],
  exports: [PublicEstimatesService],
})
export class PublicEstimatesModule {}
