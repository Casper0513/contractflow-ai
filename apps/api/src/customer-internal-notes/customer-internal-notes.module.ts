import { Module } from '@nestjs/common';

import { CustomerInternalNotesController } from './customer-internal-notes.controller';
import { CustomerInternalNotesService } from './customer-internal-notes.service';
import { FollowUpsController } from './follow-ups.controller';

@Module({
  controllers: [CustomerInternalNotesController, FollowUpsController],

  providers: [CustomerInternalNotesService],

  exports: [CustomerInternalNotesService],
})
export class CustomerInternalNotesModule {}
