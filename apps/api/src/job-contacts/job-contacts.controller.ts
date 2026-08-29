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
import { CreateJobContactDto } from './dto/create-job-contact.dto';
import { UpdateJobContactDto } from './dto/update-job-contact.dto';
import { JobContactsService } from './job-contacts.service';

@Controller('jobs/:jobId/contacts')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobContactsController {
  constructor(private readonly jobContactsService: JobContactsService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobContactsService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
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
    @Body() input: CreateJobContactDto,
  ) {
    return this.jobContactsService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':contactId')
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
    @Param('contactId') contactId: string,
    @Body() input: UpdateJobContactDto,
  ) {
    return this.jobContactsService.updateForUser(
      authUser.clerkUserId,
      jobId,
      contactId,
      input,
    );
  }

  @Patch(':contactId/primary')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
    OrganizationRole.TECHNICIAN,
  )
  setPrimary(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.jobContactsService.setPrimaryForUser(
      authUser.clerkUserId,
      jobId,
      contactId,
    );
  }

  @Delete(':contactId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('contactId') contactId: string,
  ) {
    return this.jobContactsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      contactId,
    );
  }
}
