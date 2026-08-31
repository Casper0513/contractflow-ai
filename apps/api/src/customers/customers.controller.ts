import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { SendCustomerEmailDto } from './dto/send-customer-email.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Query('includeArchived') includeArchived?: string,
  ) {
    return this.customersService.listForUser(
      authUser.clerkUserId,
      includeArchived === 'true',
      authUser.activeOrganizationId,
    );
  }

  @Get(':id/activity')
  activity(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customersService.listActivityForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }

  @Get(':id/communications')
  communications(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customersService.listCommunicationsForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }

  @Post(':id/communications')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  sendCommunication(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: SendCustomerEmailDto,
  ) {
    return this.customersService.sendCommunicationForUser(
      authUser.clerkUserId,
      id,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Post(':id/communications/:communicationId/retry')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  retryCommunication(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Param('communicationId')
    communicationId: string,
  ) {
    return this.customersService.retryCommunicationForUser(
      authUser.clerkUserId,
      id,
      communicationId,
      authUser.activeOrganizationId,
    );
  }

  @Get(':id')
  getById(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.getByIdForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }

  @Post()
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateCustomerDto,
  ) {
    return this.customersService.createForUser(
      authUser.clerkUserId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':id')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateCustomerDto,
  ) {
    return this.customersService.updateForUser(
      authUser.clerkUserId,
      id,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':id/archive')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  archive(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.archiveForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':id/restore')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  restore(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.restoreForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':id')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  )
  delete(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.deleteForUser(
      authUser.clerkUserId,
      id,
      authUser.activeOrganizationId,
    );
  }
}
