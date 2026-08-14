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
import { CreateJobTaskDto } from './dto/create-job-task.dto';
import { UpdateJobTaskDto } from './dto/update-job-task.dto';
import { JobTasksService } from './job-tasks.service';

@Controller('jobs/:jobId/tasks')
@UseGuards(ClerkAuthGuard)
export class JobTasksController {
  constructor(private readonly jobTasksService: JobTasksService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobTasksService.listForJobForUser(authUser.clerkUserId, jobId);
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: CreateJobTaskDto,
  ) {
    return this.jobTasksService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':taskId')
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
    );
  }

  @Patch(':taskId/complete')
  complete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.completeForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
    );
  }

  @Patch(':taskId/reopen')
  reopen(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.reopenForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
    );
  }

  @Delete(':taskId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.jobTasksService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      taskId,
    );
  }
}
