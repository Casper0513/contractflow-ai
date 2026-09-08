import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobNotesController } from './job-notes.controller';
import { JobNotesService } from './job-notes.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobNotesController],
  providers: [JobNotesService],
  exports: [JobNotesService],
})
export class JobNotesModule {}
