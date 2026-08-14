import { Module } from '@nestjs/common';

import { JobSchedulesController } from './job-schedules.controller';
import { JobSchedulesService } from './job-schedules.service';
import { SchedulesController } from './schedules.controller';

@Module({
  controllers: [JobSchedulesController, SchedulesController],
  providers: [JobSchedulesService],
  exports: [JobSchedulesService],
})
export class JobSchedulesModule {}
