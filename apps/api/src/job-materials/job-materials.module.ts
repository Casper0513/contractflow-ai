import { Module } from '@nestjs/common';

import { ActivityModule } from '../activity/activity.module';
import { JobMaterialsController } from './job-materials.controller';
import { JobMaterialsService } from './job-materials.service';

@Module({
  imports: [ActivityModule],
  controllers: [JobMaterialsController],
  providers: [JobMaterialsService],
  exports: [JobMaterialsService],
})
export class JobMaterialsModule {}
