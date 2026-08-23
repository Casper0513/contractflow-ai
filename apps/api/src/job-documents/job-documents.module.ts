import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { JobDocumentsController } from './job-documents.controller';
import { JobDocumentsService } from './job-documents.service';

@Module({
  imports: [StorageModule],
  controllers: [JobDocumentsController],
  providers: [JobDocumentsService],
  exports: [JobDocumentsService],
})
export class JobDocumentsModule {}
