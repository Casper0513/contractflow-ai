import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { JobContactsController } from './job-contacts.controller';
import { JobContactsService } from './job-contacts.service';

@Module({
  imports: [AuthModule],
  controllers: [JobContactsController],
  providers: [JobContactsService],
  exports: [JobContactsService],
})
export class JobContactsModule {}
