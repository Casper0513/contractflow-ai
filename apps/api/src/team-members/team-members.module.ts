import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';

import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [TeamMembersController],
  providers: [TeamMembersService],
  exports: [TeamMembersService],
})
export class TeamMembersModule {}
