import { Controller, Delete, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from './authenticated-user';
import { AuthService } from './auth.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  getCurrentUser(@CurrentUser() authUser: AuthenticatedUser) {
    return this.authService.synchronizeUser(authUser.clerkUserId);
  }

  @Delete('organization-membership')
  @UseGuards(ClerkAuthGuard)
  leaveOrganization(@CurrentUser() authUser: AuthenticatedUser) {
    return this.authService.leaveOrganizationForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }

  @Delete('account')
  @UseGuards(ClerkAuthGuard)
  deleteAccount(@CurrentUser() authUser: AuthenticatedUser) {
    return this.authService.deleteAccountForUser(authUser.clerkUserId);
  }
}
