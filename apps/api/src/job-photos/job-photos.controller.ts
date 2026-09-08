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
import { BillingEntitlementGuard } from '../billing/billing-entitlement.guard';
import { BillingEntitlement } from '../billing/billing-entitlement.policy';
import { RequiresBillingEntitlement } from '../billing/requires-billing-entitlement.decorator';
import { CreateJobPhotoDto } from './dto/create-job-photo.dto';
import { CreateJobPhotoUploadDto } from './dto/create-job-photo-upload.dto';
import { JobPhotosService } from './job-photos.service';

@Controller('jobs/:jobId/photos')
@UseGuards(ClerkAuthGuard, RolesGuard, BillingEntitlementGuard)
@RequiresBillingEntitlement(BillingEntitlement.CORE_OPERATIONS)
export class JobPhotosController {
  constructor(private readonly jobPhotosService: JobPhotosService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.jobPhotosService.listForJobForUser(
      authUser.clerkUserId,
      jobId,
      authUser.activeOrganizationId,
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
    input: CreateJobPhotoUploadDto,
  ) {
    return this.jobPhotosService.createUploadUrlForUser(
      authUser.clerkUserId,
      jobId,
      input,
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
  create(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
    @Body()
    input: CreateJobPhotoDto,
  ) {
    return this.jobPhotosService.createForUser(
      authUser.clerkUserId,
      jobId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':photoId')
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
    @Param('photoId')
    photoId: string,
  ) {
    return this.jobPhotosService.deleteForUser(
      authUser.clerkUserId,
      jobId,
      photoId,
      authUser.activeOrganizationId,
    );
  }
}
