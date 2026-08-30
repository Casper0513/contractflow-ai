import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';

import { CrewController } from './crew.controller';
import { CrewService } from './crew.service';

@Module({
  imports: [AuthModule],
  controllers: [CrewController],
  providers: [CrewService],
  exports: [CrewService],
})
export class CrewModule {}
