import { Module } from '@nestjs/common';

import { JobTimeEntriesController } from './job-time-entries.controller';
import { JobTimeEntriesService } from './job-time-entries.service';

@Module({
  controllers: [JobTimeEntriesController],
  providers: [JobTimeEntriesService],
  exports: [JobTimeEntriesService],
})
export class JobTimeEntriesModule {}
