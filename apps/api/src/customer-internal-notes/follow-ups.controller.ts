import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomerInternalNotesService } from './customer-internal-notes.service';

@Controller('follow-ups')
@UseGuards(ClerkAuthGuard)
export class FollowUpsController {
  constructor(
    private readonly customerInternalNotesService: CustomerInternalNotesService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.customerInternalNotesService.listFollowUpsForUser(
      authUser.clerkUserId,
      authUser.activeOrganizationId,
    );
  }
}
