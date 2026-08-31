import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AssignJobScheduleCrewMemberDto } from './dto/assign-job-schedule-crew-member.dto';
import { CreateJobScheduleDto } from './dto/create-job-schedule.dto';
import { DispatchJobScheduleDto } from './dto/dispatch-job-schedule.dto';
import { ScheduleBacklogJobDto } from './dto/schedule-backlog-job.dto';
import { UpdateJobScheduleDto } from './dto/update-job-schedule.dto';
import { JobSchedulesService } from './job-schedules.service';

@Controller('jobs/:jobId/schedules')
@UseGuards(ClerkAuthGuard, RolesGuard)
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
      authUser.activeOrganizationId,
    );
  }

  @Post('dispatch-backlog')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  scheduleBacklogJob(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Body()
    input: ScheduleBacklogJobDto,
  ) {
    return this.jobSchedulesService.scheduleBacklogJobForUser(
      authUser.clerkUserId,
      jobId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
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
      authUser.activeOrganizationId,
    );
  }

  @Patch(':scheduleId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
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
      authUser.activeOrganizationId,
    );
  }

  @Post(':scheduleId/crew')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  assignCrewMember(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,

    @Body()
    input: AssignJobScheduleCrewMemberDto,
  ) {
    return this.jobSchedulesService.assignCrewMemberForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
      input.crewMemberId,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':scheduleId/crew/:crewMemberId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  removeCrewMember(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,

    @Param('crewMemberId')
    crewMemberId: string,
  ) {
    return this.jobSchedulesService.removeCrewMemberForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
      crewMemberId,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':scheduleId/dispatch')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  dispatch(
    @CurrentUser()
    authUser: AuthenticatedUser,

    @Param('jobId')
    jobId: string,

    @Param('scheduleId')
    scheduleId: string,

    @Body()
    input: DispatchJobScheduleDto,
  ) {
    return this.jobSchedulesService.dispatchForUser(
      authUser.clerkUserId,
      jobId,
      scheduleId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':scheduleId/cancel')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
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
      authUser.activeOrganizationId,
    );
  }

  @Patch(':scheduleId/restore')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
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
      authUser.activeOrganizationId,
    );
  }
}
