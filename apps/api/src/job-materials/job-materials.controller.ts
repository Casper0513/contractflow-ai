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
import { CreateJobMaterialDto } from './dto/create-job-material.dto';
import { UpdateJobMaterialDto } from './dto/update-job-material.dto';
import { JobMaterialsService } from './job-materials.service';

@Controller('jobs/:jobId/materials')
@UseGuards(ClerkAuthGuard)
export class JobMaterialsController {
  constructor(private readonly jobMaterialsService: JobMaterialsService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobMaterialsService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
    );
  }

  @Get(':materialId')
  getOne(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.getForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: CreateJobMaterialDto,
  ) {
    return this.jobMaterialsService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':materialId')
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
    @Body() input: UpdateJobMaterialDto,
  ) {
    return this.jobMaterialsService.updateForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
      input,
    );
  }

  @Delete(':materialId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }
}
