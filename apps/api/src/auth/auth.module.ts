import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkAuthGuard, RolesGuard],
  exports: [AuthService, ClerkAuthGuard, RolesGuard],
})
export class AuthModule {}
