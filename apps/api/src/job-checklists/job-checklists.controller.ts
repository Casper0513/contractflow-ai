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
import { ApplyChecklistTemplateDto } from './dto/apply-checklist-template.dto';
import { UpdateJobChecklistDto } from './dto/update-job-checklist.dto';
import { JobChecklistsService } from './job-checklists.service';

@Controller('jobs/:jobId/checklists')
@UseGuards(ClerkAuthGuard)
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
    );
  }

  @Post()
  applyTemplate(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Body() input: ApplyChecklistTemplateDto,
  ) {
    return this.jobChecklistsService.applyTemplateForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':checklistId')
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
    );
  }

  @Patch(':checklistId/items/:itemId/complete')
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
    );
  }

  @Patch(':checklistId/items/:itemId/reopen')
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
    );
  }

  @Delete(':checklistId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('checklistId') checklistId: string,
  ) {
    return this.jobChecklistsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      checklistId,
    );
  }
}
