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
import { CreateJobCostDto } from './dto/create-job-cost.dto';
import { UpdateJobCostDto } from './dto/update-job-cost.dto';
import { JobCostsService } from './job-costs.service';

@Controller('jobs/:jobId/costs')
@UseGuards(ClerkAuthGuard)
export class JobCostsController {
  constructor(private readonly jobCostsService: JobCostsService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobCostsService.listForJobForUser(authUser.clerkUserId, jobId);
  }

  @Get('summary')
  summary(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobCostsService.getSummaryForJobForUser(
      authUser.clerkUserId,
      jobId,
    );
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: CreateJobCostDto,
  ) {
    return this.jobCostsService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':costId')
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('costId') costId: string,
    @Body() input: UpdateJobCostDto,
  ) {
    return this.jobCostsService.updateForUser(
      authUser.clerkUserId,
      jobId,
      costId,
      input,
    );
  }

  @Delete(':costId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('costId') costId: string,
  ) {
    return this.jobCostsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      costId,
    );
  }
}
