import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateDispatchSettingsDto } from './dto/update-dispatch-settings.dto';
import { UpdateEstimateReminderSettingsDto } from './dto/update-estimate-reminder-settings.dto';
import { UpdateInvoiceReminderSettingsDto } from './dto/update-invoice-reminder-settings.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(ClerkAuthGuard, RolesGuard)
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

  @Get('current/estimate-reminder-settings')
  getCurrentEstimateReminderSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.organizationsService.getEstimateReminderSettingsForUser(
      authUser.clerkUserId,
    );
  }

  @Get('current/dispatch-settings')
  getCurrentDispatchSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.organizationsService.getDispatchSettingsForUser(
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
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
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

  @Patch('current/estimate-reminder-settings')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  updateCurrentEstimateReminderSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: UpdateEstimateReminderSettingsDto,
  ) {
    return this.organizationsService.updateEstimateReminderSettingsForUser(
      authUser.clerkUserId,
      input,
    );
  }

  @Patch('current/dispatch-settings')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
  updateCurrentDispatchSettings(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Body()
    input: UpdateDispatchSettingsDto,
  ) {
    return this.organizationsService.updateDispatchSettingsForUser(
      authUser.clerkUserId,
      input,
    );
  }

  @Patch('current')
  @Roles(OrganizationRole.OWNER, OrganizationRole.ADMIN)
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
