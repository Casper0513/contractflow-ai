import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateJobScheduleDto } from './dto/create-job-schedule.dto';
import { UpdateJobScheduleDto } from './dto/update-job-schedule.dto';
import { JobSchedulesService } from './job-schedules.service';

@Controller('jobs/:jobId/schedules')
@UseGuards(ClerkAuthGuard)
export class JobSchedulesController {
  constructor(private readonly jobSchedulesService: JobSchedulesService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Query('includeCancelled')
    includeCancelled?: string,
  ) {
    return this.jobSchedulesService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
      includeCancelled === 'true',
    );
  }

  @Post()
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Body()
    input: CreateJobScheduleDto,
  ) {
    return this.jobSchedulesService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':scheduleId')
  update(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,

    @Body()
    input: UpdateJobScheduleDto,
  ) {
    return this.jobSchedulesService.updateForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
      input,
    );
  }

  @Patch(':scheduleId/cancel')
  cancel(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,
  ) {
    return this.jobSchedulesService.cancelForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
    );
  }

  @Patch(':scheduleId/restore')
  restore(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,
  ) {
    return this.jobSchedulesService.restoreForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
    );
  }
}
