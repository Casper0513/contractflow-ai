import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { JobMaterialsController } from './job-materials.controller';
import { JobMaterialsService } from './job-materials.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [JobMaterialsController],
  providers: [JobMaterialsService],
  exports: [JobMaterialsService],
})
export class JobMaterialsModule {}
