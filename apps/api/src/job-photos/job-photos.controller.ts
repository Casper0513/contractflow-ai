import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateJobPhotoDto } from './dto/create-job-photo.dto';
import { CreateJobPhotoUploadDto } from './dto/create-job-photo-upload.dto';
import { JobPhotosService } from './job-photos.service';

@Controller('jobs/:jobId/photos')
@UseGuards(ClerkAuthGuard)
export class JobPhotosController {
  constructor(private readonly jobPhotosService: JobPhotosService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('jobId')
    jobId: string,
  ) {
    return this.jobPhotosService.listForJobForUser(authUser.clerkUserId, jobId);
  }

  @Post('upload-url')
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
    );
  }

  @Post()
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
    );
  }

  @Delete(':photoId')
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
    );
  }
}
