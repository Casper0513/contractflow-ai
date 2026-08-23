import { Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';
import { JobPhotosController } from './job-photos.controller';
import { JobPhotosService } from './job-photos.service';

@Module({
  imports: [StorageModule],
  controllers: [JobPhotosController],
  providers: [JobPhotosService],
  exports: [JobPhotosService],
})
export class JobPhotosModule {}
