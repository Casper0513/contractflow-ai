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

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { SendCustomerEmailDto } from './dto/send-customer-email.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
@UseGuards(ClerkAuthGuard)
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
    );
  }

  @Get(':id/activity')
  activity(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customersService.listActivityForUser(authUser.clerkUserId, id);
  }

  @Get(':id/communications')
  communications(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.customersService.listCommunicationsForUser(
      authUser.clerkUserId,
      id,
    );
  }

  @Post(':id/communications')
  sendCommunication(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: SendCustomerEmailDto,
  ) {
    return this.customersService.sendCommunicationForUser(
      authUser.clerkUserId,
      id,
      input,
    );
  }

  @Post(':id/communications/:communicationId/retry')
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
    );
  }

  @Get(':id')
  getById(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.getByIdForUser(authUser.clerkUserId, id);
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Body() input: CreateCustomerDto,
  ) {
    return this.customersService.createForUser(authUser.clerkUserId, input);
  }

  @Patch(':id')
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateCustomerDto,
  ) {
    return this.customersService.updateForUser(authUser.clerkUserId, id, input);
  }

  @Patch(':id/archive')
  archive(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.archiveForUser(authUser.clerkUserId, id);
  }

  @Patch(':id/restore')
  restore(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.restoreForUser(authUser.clerkUserId, id);
  }

  @Delete(':id')
  delete(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.deleteForUser(authUser.clerkUserId, id);
  }
}
