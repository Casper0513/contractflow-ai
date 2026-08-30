import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { JobSchedulesController } from './job-schedules.controller';
import { JobSchedulesService } from './job-schedules.service';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [AuthModule],
  controllers: [JobSchedulesController, SchedulesController],
  providers: [JobSchedulesService],
  exports: [JobSchedulesService],
})
export class JobSchedulesModule {}
