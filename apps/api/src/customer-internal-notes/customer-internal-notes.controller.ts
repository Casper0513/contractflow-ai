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
import { CustomerInternalNotesService } from './customer-internal-notes.service';
import { CreateCustomerInternalNoteDto } from './dto/create-customer-internal-note.dto';
import { UpdateCustomerInternalNoteDto } from './dto/update-customer-internal-note.dto';

@Controller('customers/:customerId/internal-notes')
@UseGuards(ClerkAuthGuard)
export class CustomerInternalNotesController {
  constructor(
    private readonly customerInternalNotesService: CustomerInternalNotesService,
  ) {}

  @Get()
  list(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.customerInternalNotesService.listForCustomerForUser(
      authUser.clerkUserId,
      customerId,
      authUser.activeOrganizationId,
    );
  }

  @Post()
  create(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Body() input: CreateCustomerInternalNoteDto,
  ) {
    return this.customerInternalNotesService.createForUser(
      authUser.clerkUserId,
      customerId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Patch(':noteId')
  update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('noteId') noteId: string,
    @Body() input: UpdateCustomerInternalNoteDto,
  ) {
    return this.customerInternalNotesService.updateForUser(
      authUser.clerkUserId,
      customerId,
      noteId,
      input,
      authUser.activeOrganizationId,
    );
  }

  @Delete(':noteId')
  delete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.customerInternalNotesService.deleteForUser(
      authUser.clerkUserId,
      customerId,
      noteId,
      authUser.activeOrganizationId,
    );
  }

  @Post(':noteId/complete')
  complete(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.customerInternalNotesService.completeForUser(
      authUser.clerkUserId,
      customerId,
      noteId,
      authUser.activeOrganizationId,
    );
  }

  @Post(':noteId/reopen')
  reopen(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('customerId') customerId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.customerInternalNotesService.reopenForUser(
      authUser.clerkUserId,
      customerId,
      noteId,
      authUser.activeOrganizationId,
    );
  }
}
