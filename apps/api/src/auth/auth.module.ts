import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { OrganizationMembershipService } from './organization-membership.service';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    ClerkAuthGuard,
    OrganizationMembershipService,
    RolesGuard,
  ],
  exports: [
    AuthService,
    ClerkAuthGuard,
    OrganizationMembershipService,
    RolesGuard,
  ],
})
export class AuthModule {}
