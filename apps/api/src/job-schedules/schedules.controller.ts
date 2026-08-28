import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JobSchedulesService } from './job-schedules.service';

@Controller('schedules')
@UseGuards(ClerkAuthGuard)
export class SchedulesController {
  constructor(private readonly jobSchedulesService: JobSchedulesService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Query('from')
    from?: string,

    @Query('to')
    to?: string,

    @Query('includeCancelled')
    includeCancelled?: string,

    @Query('crewMemberId')
    crewMemberId?: string,
  ) {
    return this.jobSchedulesService.listForOrganizationForUser(
      authUser.clerkUserId,
      {
        from,
        to,
        includeCancelled: includeCancelled === 'true',
        crewMemberId: crewMemberId?.trim() || undefined,
      },
    );
  }
}
