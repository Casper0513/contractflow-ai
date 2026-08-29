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
import { CreateJobMaterialDto } from './dto/create-job-material.dto';
import { UpdateJobMaterialDto } from './dto/update-job-material.dto';
import { JobMaterialsService } from './job-materials.service';

@Controller('jobs/:jobId/materials')
@UseGuards(ClerkAuthGuard, RolesGuard)
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
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
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
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
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

  @Patch(':materialId/order')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
  order(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.orderForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }

  @Patch(':materialId/receive')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
  receive(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.receiveForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }

  @Patch(':materialId/cancel')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
  cancel(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.cancelForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }

  @Patch(':materialId/restore')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
  restore(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('materialId') materialId: string,
  ) {
    return this.jobMaterialsService.restoreForUser(
      authUser.clerkUserId,
      jobId,
      materialId,
    );
  }

  @Delete(':materialId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
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
