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
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query('includeArchived')
    includeArchived?: string,
  ) {
    return this.jobsService.listForUser(
      authUser.clerkUserId,
      includeArchived === 'true',
    );
  }

  @Get('dispatch-backlog')
  listDispatchBacklog(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.jobsService.listDispatchBacklogForUser(authUser.clerkUserId);
  }

  @Get('customer/:customerId')
  listForCustomer(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Query('includeArchived')
    includeArchived?: string,
  ) {
    return this.jobsService.listForCustomerForUser(
      authUser.clerkUserId,
      customerId,
      includeArchived === 'true',
    );
  }

  @Get(':id/activity')
  listActivity(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.jobsService.listActivityForUser(authUser.clerkUserId, id);
  }

  @Get(':id')
  getById(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.getByIdForUser(authUser.clerkUserId, id);
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateJobDto,
  ) {
    return this.jobsService.createForUser(authUser.clerkUserId, input);
  }

  @Post('from-estimate/:estimateId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  createFromEstimate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('estimateId') estimateId: string,
  ) {
    return this.jobsService.createFromEstimateForUser(
      authUser.clerkUserId,
      estimateId,
    );
  }

  @Patch(':id')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateJobDto,
  ) {
    return this.jobsService.updateForUser(authUser.clerkUserId, id, input);
  }

  @Patch(':id/archive')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  archive(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.archiveForUser(authUser.clerkUserId, id);
  }

  @Patch(':id/restore')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  restore(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.jobsService.restoreForUser(authUser.clerkUserId, id);
  }
}
