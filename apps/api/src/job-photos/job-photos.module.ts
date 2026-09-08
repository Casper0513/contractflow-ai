import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { StorageModule } from '../storage/storage.module';
import { JobPhotosController } from './job-photos.controller';
import { JobPhotosService } from './job-photos.service';

@Module({
  imports: [AuthModule, BillingModule, StorageModule],
  controllers: [JobPhotosController],
  providers: [JobPhotosService],
  exports: [JobPhotosService],
})
export class JobPhotosModule {}
