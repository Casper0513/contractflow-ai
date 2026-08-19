import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateInvoiceReminderSettingsDto } from './dto/update-invoice-reminder-settings.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(ClerkAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  getOrganizations(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.organizationsService.getForUser(authUser.clerkUserId);
  }

  @Get('current')
  getCurrentOrganization(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.organizationsService.getCurrentForUser(authUser.clerkUserId);
  }

  @Get('current/invoice-reminder-settings')
  getCurrentInvoiceReminderSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.organizationsService.getInvoiceReminderSettingsForUser(
      authUser.clerkUserId,
    );
  }

  @Post()
  createOrganization(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: CreateOrganizationDto,
  ) {
    return this.organizationsService.createForOwner(
      authUser.clerkUserId,
      input,
    );
  }

  @Patch('current/invoice-reminder-settings')
  updateCurrentInvoiceReminderSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: UpdateInvoiceReminderSettingsDto,
  ) {
    return this.organizationsService.updateInvoiceReminderSettingsForUser(
      authUser.clerkUserId,
      input,
    );
  }

  @Patch('current')
  updateCurrentOrganization(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: UpdateOrganizationDto,
  ) {
    return this.organizationsService.updateCurrentForUser(
      authUser.clerkUserId,
      input,
    );
  }
}
