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

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateJobTimeEntryDto } from './dto/create-job-time-entry.dto';
import { UpdateJobTimeEntryDto } from './dto/update-job-time-entry.dto';
import { JobTimeEntriesService } from './job-time-entries.service';

@Controller('jobs/:jobId/time-entries')
@UseGuards(ClerkAuthGuard)
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
