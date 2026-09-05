import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { JobChecklistsController } from './job-checklists.controller';
import { JobChecklistsService } from './job-checklists.service';

@Module({
  imports: [AuthModule],
  controllers: [JobChecklistsController],
  providers: [JobChecklistsService],
  exports: [JobChecklistsService],
})
export class JobChecklistsModule {}
