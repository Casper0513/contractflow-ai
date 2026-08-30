import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { JobTimeEntriesController } from './job-time-entries.controller';
import { JobTimeEntriesService } from './job-time-entries.service';

@Module({
  imports: [AuthModule],
  controllers: [JobTimeEntriesController],
  providers: [JobTimeEntriesService],
  exports: [JobTimeEntriesService],
})
export class JobTimeEntriesModule {}
