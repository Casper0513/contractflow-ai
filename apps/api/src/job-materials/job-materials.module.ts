import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { ActivityModule } from '../activity/activity.module';
import { JobMaterialsController } from './job-materials.controller';
import { JobMaterialsService } from './job-materials.service';

@Module({
  imports: [AuthModule, ActivityModule],
  controllers: [JobMaterialsController],
  providers: [JobMaterialsService],
  exports: [JobMaterialsService],
})
export class JobMaterialsModule {}
