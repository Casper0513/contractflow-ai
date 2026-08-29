import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateJobTimeEntryDto } from './dto/create-job-time-entry.dto';
import { UpdateJobTimeEntryDto } from './dto/update-job-time-entry.dto';
import { JobTimeEntriesService } from './job-time-entries.service';

@Controller('jobs/:jobId/time-entries')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobTimeEntriesController {
  constructor(private readonly jobTimeEntriesService: JobTimeEntriesService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.jobTimeEntriesService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
    );
  }

  @Get(':timeEntryId')
  getOne(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Param('timeEntryId')
    timeEntryId: string,
  ) {
    return this.jobTimeEntriesService.getForUser(
      authUser.clerkUserId,
      jobId,
      timeEntryId,
    );
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Body()
    input: CreateJobTimeEntryDto,
  ) {
    return this.jobTimeEntriesService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':timeEntryId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  update(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Param('timeEntryId')
    timeEntryId: string,
    @Body()
    input: UpdateJobTimeEntryDto,
  ) {
    return this.jobTimeEntriesService.updateForUser(
      authUser.clerkUserId,
      jobId,
      timeEntryId,
      input,
    );
  }

  @Delete(':timeEntryId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Param('timeEntryId')
    timeEntryId: string,
  ) {
    return this.jobTimeEntriesService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      timeEntryId,
    );
  }
}
