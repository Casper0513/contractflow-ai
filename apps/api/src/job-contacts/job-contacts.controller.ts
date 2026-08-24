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
import { CreateJobContactDto } from './dto/create-job-contact.dto';
import { UpdateJobContactDto } from './dto/update-job-contact.dto';
import { JobContactsService } from './job-contacts.service';

@Controller('jobs/:jobId/contacts')
@UseGuards(ClerkAuthGuard)
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
