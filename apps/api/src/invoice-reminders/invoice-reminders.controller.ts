import { Controller, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { InvoiceRemindersService } from './invoice-reminders.service';

@Controller('invoice-reminders')
@UseGuards(ClerkAuthGuard)
export class InvoiceRemindersController {
  constructor(
    private readonly invoiceRemindersService: InvoiceRemindersService,
  ) {}

  @Post('run')
  run(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.invoiceRemindersService.processForUser(authUser.clerkUserId);
  }
}
