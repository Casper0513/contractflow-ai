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
import { CreateJobTaskDto } from './dto/create-job-task.dto';
import { UpdateJobTaskDto } from './dto/update-job-task.dto';
import { JobTasksService } from './job-tasks.service';

@Controller('jobs/:jobId/tasks')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobTasksController {
  constructor(private readonly jobTasksService: JobTasksService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobTasksService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
      authUser.activeOrganizationId,
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
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: CreateJobTaskDto,
  ) {
    return this.jobTasksService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':taskId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
    @Body() input: UpdateJobTaskDto,
  ) {
    return this.jobTasksService.updateForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':taskId/complete')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  complete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.completeForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':taskId/reopen')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  reopen(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.reopenForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':taskId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
      authUser.activeOrganizationId,
    );
  }
}
