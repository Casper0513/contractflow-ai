import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerInternalNoteKind,
  NotificationType,
  Prisma,
  prisma,
} from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

type CreateNotificationInput = {
  organizationId: string;
  recipientUserId: string;
  actorUserId?: string | null;

  type: NotificationType;

  title: string;
  message: string;

  href?: string | null;

  customerInternalNoteId?: string | null;

  dedupeKey?: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.notification.findMany({
      where: {
        organizationId: membership.organizationId,
        recipientUserId: membership.userId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take: 100,

      select: this.notificationSelect(),
    });
  }

  async unreadCountForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const count = await prisma.notification.count({
      where: {
        organizationId: membership.organizationId,
        recipientUserId: membership.userId,
        readAt: null,
      },
    });

    return {
      count,
    };
  }

  async markReadForUser(
    clerkUserId: string,
    notificationId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId: membership.organizationId,
        recipientUserId: membership.userId,
      },

      select: {
        id: true,
        readAt: true,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.readAt) {
      return prisma.notification.findUniqueOrThrow({
        where: {
          id: notification.id,
        },

        select: this.notificationSelect(),
      });
    }

    return prisma.notification.update({
      where: {
        id: notification.id,
      },

      data: {
        readAt: new Date(),
      },

      select: this.notificationSelect(),
    });
  }

  async markAllReadForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const result = await prisma.notification.updateMany({
      where: {
        organizationId: membership.organizationId,
        recipientUserId: membership.userId,
        readAt: null,
      },

      data: {
        readAt: new Date(),
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }

  async create(input: CreateNotificationInput) {
    if (input.dedupeKey) {
      return prisma.notification.upsert({
        where: {
          dedupeKey: input.dedupeKey,
        },

        create: {
          organizationId: input.organizationId,
          recipientUserId: input.recipientUserId,
          actorUserId: input.actorUserId ?? null,

          type: input.type,

          title: input.title,
          message: input.message,

          href: input.href ?? null,

          customerInternalNoteId: input.customerInternalNoteId ?? null,

          dedupeKey: input.dedupeKey,
        },

        update: {},

        select: this.notificationSelect(),
      });
    }

    return prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId ?? null,

        type: input.type,

        title: input.title,
        message: input.message,

        href: input.href ?? null,

        customerInternalNoteId: input.customerInternalNoteId ?? null,
      },

      select: this.notificationSelect(),
    });
  }

  async processFollowUpNotifications() {
    const followUps = await prisma.customerInternalNote.findMany({
      where: {
        kind: CustomerInternalNoteKind.FOLLOW_UP,

        completedAt: null,

        dueAt: {
          not: null,
        },

        assignedToUserId: {
          not: null,
        },

        customer: {
          archivedAt: null,
        },
      },

      select: {
        id: true,
        organizationId: true,
        customerId: true,

        content: true,

        assignedToUserId: true,
        dueAt: true,

        organization: {
          select: {
            timezone: true,
          },
        },
      },

      orderBy: {
        dueAt: 'asc',
      },
    });

    const now = new Date();

    let dueTodayCreated = 0;
    let overdueCreated = 0;
    let skipped = 0;

    const failures: Array<{
      followUpId: string;
      message: string;
    }> = [];

    for (const followUp of followUps) {
      const recipientUserId = followUp.assignedToUserId;
      const dueAt = followUp.dueAt;

      if (!recipientUserId || !dueAt) {
        skipped += 1;
        continue;
      }

      try {
        const timezone = followUp.organization.timezone || 'America/Edmonton';

        const todayKey = dateKeyInTimezone(now, timezone);
        const dueDateKey = dateKeyInTimezone(dueAt, timezone);

        if (dueDateKey === todayKey) {
          const dedupeKey = [
            'follow-up-due-today',
            followUp.id,
            recipientUserId,
            todayKey,
          ].join(':');

          const existed = await prisma.notification.findUnique({
            where: {
              dedupeKey,
            },

            select: {
              id: true,
            },
          });

          await this.create({
            organizationId: followUp.organizationId,
            recipientUserId,

            type: NotificationType.FOLLOW_UP_DUE_TODAY,

            title: 'Follow-up due today',
            message: followUp.content,

            href: `/customers/${followUp.customerId}`,

            customerInternalNoteId: followUp.id,

            dedupeKey,
          });

          if (!existed) {
            dueTodayCreated += 1;
          } else {
            skipped += 1;
          }

          continue;
        }

        if (dueDateKey < todayKey) {
          const dedupeKey = [
            'follow-up-overdue',
            followUp.id,
            recipientUserId,
          ].join(':');

          const existed = await prisma.notification.findUnique({
            where: {
              dedupeKey,
            },

            select: {
              id: true,
            },
          });

          await this.create({
            organizationId: followUp.organizationId,
            recipientUserId,

            type: NotificationType.FOLLOW_UP_OVERDUE,

            title: 'Follow-up overdue',
            message: followUp.content,

            href: `/customers/${followUp.customerId}`,

            customerInternalNoteId: followUp.id,

            dedupeKey,
          });

          if (!existed) {
            overdueCreated += 1;
          } else {
            skipped += 1;
          }

          continue;
        }

        skipped += 1;
      } catch (error) {
        failures.push({
          followUpId: followUp.id,
          message: getErrorMessage(error),
        });
      }
    }

    return {
      scanned: followUps.length,
      dueTodayCreated,
      overdueCreated,
      skipped,
      failures,
    };
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private notificationSelect(): Prisma.NotificationSelect {
    return {
      id: true,

      organizationId: true,
      recipientUserId: true,
      actorUserId: true,

      type: true,

      title: true,
      message: true,
      href: true,

      customerInternalNoteId: true,

      readAt: true,
      createdAt: true,

      actor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
}

function dateKeyInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Unable to calculate date in timezone ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
