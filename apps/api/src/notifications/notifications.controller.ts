import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(ClerkAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.notificationsService.listForUser(authUser.clerkUserId);
  }

  @Get('unread-count')
  unreadCount(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.notificationsService.unreadCountForUser(authUser.clerkUserId);
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser()
    authUser: AuthenticatedUser,
  ) {
    return this.notificationsService.markAllReadForUser(authUser.clerkUserId);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser()
    authUser: AuthenticatedUser,
    @Param('id') notificationId: string,
  ) {
    return this.notificationsService.markReadForUser(
      authUser.clerkUserId,
      notificationId,
    );
  }
}
