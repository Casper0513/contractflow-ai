import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { StorageModule } from '../storage/storage.module';
import { JobDocumentsController } from './job-documents.controller';
import { JobDocumentsService } from './job-documents.service';

@Module({
  imports: [AuthModule, BillingModule, StorageModule],
  controllers: [JobDocumentsController],
  providers: [JobDocumentsService],
  exports: [JobDocumentsService],
})
export class JobDocumentsModule {}
