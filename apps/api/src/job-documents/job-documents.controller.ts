import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateJobDocumentDto } from './dto/create-job-document.dto';
import { CreateJobDocumentUploadDto } from './dto/create-job-document-upload.dto';
import { JobDocumentsService } from './job-documents.service';

@Controller('jobs/:jobId/documents')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class JobDocumentsController {
  constructor(private readonly jobDocumentsService: JobDocumentsService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.jobDocumentsService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
    );
  }

  @Post('upload-url')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.TECHNICIAN,
  )
  createUploadUrl(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Body()
    input: CreateJobDocumentUploadDto,
  ) {
    return this.jobDocumentsService.createUploadUrlForUser(
      authUser.clerkUserId,
      jobId,
      input,
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
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Body()
    input: CreateJobDocumentDto,
  ) {
    return this.jobDocumentsService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
    );
  }

  @Delete(':documentId')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Param('documentId')
    documentId: string,
  ) {
    return this.jobDocumentsService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      documentId,
    );
  }
}
