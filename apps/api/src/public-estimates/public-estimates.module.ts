import { Module } from '@nestjs/common';

import { PublicEstimatesController } from './public-estimates.controller';
import { PublicEstimatesService } from './public-estimates.service';

@Module({
  controllers: [PublicEstimatesController],
  providers: [PublicEstimatesService],
  exports: [PublicEstimatesService],
})
export class PublicEstimatesModule {}
