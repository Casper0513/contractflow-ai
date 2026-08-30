import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { JobNotesController } from './job-notes.controller';
import { JobNotesService } from './job-notes.service';

@Module({
  imports: [AuthModule],
  controllers: [JobNotesController],
  providers: [JobNotesService],
  exports: [JobNotesService],
})
export class JobNotesModule {}
