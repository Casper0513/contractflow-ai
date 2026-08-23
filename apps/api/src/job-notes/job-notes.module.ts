import { Module } from '@nestjs/common';

import { JobNotesController } from './job-notes.controller';
import { JobNotesService } from './job-notes.service';

@Module({
  controllers: [JobNotesController],
  providers: [JobNotesService],
  exports: [JobNotesService],
})
export class JobNotesModule {}
