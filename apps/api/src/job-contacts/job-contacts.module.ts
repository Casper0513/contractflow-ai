import { Module } from '@nestjs/common';

import { JobContactsController } from './job-contacts.controller';
import { JobContactsService } from './job-contacts.service';

@Module({
  controllers: [JobContactsController],
  providers: [JobContactsService],
  exports: [JobContactsService],
})
export class JobContactsModule {}
