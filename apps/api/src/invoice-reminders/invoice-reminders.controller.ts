import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InvoiceRemindersService } from './invoice-reminders.service';

@Controller('invoice-reminders')
@UseGuards(ClerkAuthGuard, RolesGuard)
export class InvoiceRemindersController {
  constructor(
    private readonly invoiceRemindersService: InvoiceRemindersService,
  ) {}

  @Post('run')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  run(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.invoiceRemindersService.processForUser(authUser.clerkUserId);
  }

  @Post('invoices/:invoiceId/run')
  @Roles(
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
    OrganizationRole.OFFICE,
  )
  runForInvoice(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoiceRemindersService.processInvoiceForUser(
      authUser.clerkUserId,
      invoiceId,
    );
  }
}
