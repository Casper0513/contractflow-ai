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
import { CreateJobNoteDto } from './dto/create-job-note.dto';
import { UpdateJobNoteDto } from './dto/update-job-note.dto';
import { JobNotesService } from './job-notes.service';

@Controller('jobs/:jobId/notes')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobNotesController {
  constructor(private readonly jobNotesService: JobNotesService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
  ) {
    return this.jobNotesService.listForJobForUser(authUser.clerkUserId, jobId);
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
    @Body() input: CreateJobNoteDto,
  ) {
    return this.jobNotesService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Patch(':noteId')
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
    @Param('noteId') noteId: string,
    @Body() input: UpdateJobNoteDto,
  ) {
    return this.jobNotesService.updateForUser(
      authUser.clerkUserId,
      jobId,
      noteId,
      input,
    );
  }

  @Delete(':noteId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('jobId') jobId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.jobNotesService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      noteId,
    );
  }
}
