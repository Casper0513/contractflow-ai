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
import { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import { UpdateJobChecklistDto } from './dto/update-job-checklist.dto';
import { JobChecklistsService } from './job-checklists.service';

@Controller('jobs/:jobId/checklists')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobChecklistsController {
  constructor(private readonly jobChecklistsService: JobChecklistsService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobChecklistsService.listForJobForUser(
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
  applyTemplate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: ApplyChecklistTemplateDto,
  ) {
    return this.jobChecklistsService.applyTemplateForUser(
      authUser.clerkUserId,
      jobId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':checklistId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('checklistId') checklistId: string,
    @Body() input: UpdateJobChecklistDto,
  ) {
    return this.jobChecklistsService.updateForUser(
      authUser.clerkUserId,
      jobId,
      checklistId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':checklistId/items/:itemId/complete')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  completeItem(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.jobChecklistsService.completeItemForUser(
      authUser.clerkUserId,
      jobId,
      checklistId,
      itemId,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':checklistId/items/:itemId/reopen')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  reopenItem(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.jobChecklistsService.reopenItemForUser(
      authUser.clerkUserId,
      jobId,
      checklistId,
      itemId,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':checklistId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('checklistId') checklistId: string,
  ) {
    return this.jobChecklistsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      checklistId,
      authUser.activeOrganizationId,
    );
  }
}
