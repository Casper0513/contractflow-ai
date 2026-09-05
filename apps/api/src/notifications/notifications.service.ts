import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerInternalNoteKind, NotificationType } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  prisma8TextParam,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

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

    const notifications = await db.orm.public.Notification.where({
      organizationId: membership.organizationId,

      recipientUserId: membership.userId,
    })
      .select(
        'id',
        'organizationId',
        'recipientUserId',
        'actorUserId',
        '_type',
        'title',
        'message',
        'href',
        'customerInternalNoteId',
        'dedupeKey',
        'readAt',
        'createdAt',
      )
      .all();

    const hydrated = [];

    for (const notification of notifications) {
      hydrated.push(await this.hydrateNotificationPrisma8(notification));
    }

    hydrated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return hydrated.slice(0, 100);
  }

  async unreadCountForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const unread = await db.orm.public.Notification.where({
      organizationId: membership.organizationId,

      recipientUserId: membership.userId,

      readAt: null,
    })
      .select('id')
      .all();

    return {
      count: unread.length,
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

    const notification = await db.orm.public.Notification.where({
      id: notificationId,

      organizationId: membership.organizationId,

      recipientUserId: membership.userId,
    })
      .select('id', 'readAt')
      .first();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      await db.orm.public.Notification.where({
        id: notification.id,
      }).update({
        readAt: toPrisma8Timestamp(),
      });
    }

    return this.requireHydratedNotificationPrisma8(
      membership.organizationId,
      membership.userId,
      notification.id,
    );
  }

  async markAllReadForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const now = toPrisma8Timestamp();

    const updatedCount = await db.transaction(async (tx) => {
      const plan = db.raw.sql`
              UPDATE "Notification"
              SET
                "readAt" = ${prisma8TimestampParam(now)}
              WHERE
                "organizationId" = ${prisma8TextParam(
                  membership.organizationId,
                )}
                AND "recipientUserId" = ${prisma8TextParam(membership.userId)}
                AND "readAt" IS NULL
            `
        .affectedCount()
        .build();

      const result = await tx.execute(plan);

      return result.affectedRows;
    });

    return {
      success: true,

      updatedCount,
    };
  }

  async create(input: CreateNotificationInput) {
    if (input.dedupeKey) {
      const existing = await this.findNotificationByDedupeKeyPrisma8(
        input.dedupeKey,
      );

      if (existing) {
        return existing;
      }

      try {
        const created = await this.createNotificationPrisma8(input);

        return this.requireHydratedNotificationPrisma8(
          created.organizationId,
          created.recipientUserId,
          created.id,
        );
      } catch (error) {
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }

        /*
         * A concurrent writer may have inserted the same
         * dedupeKey after our initial read.
         *
         * Important: this recovery read is outside the failed
         * write, so we never query inside a poisoned PostgreSQL
         * transaction.
         */
        const raced = await this.findNotificationByDedupeKeyPrisma8(
          input.dedupeKey,
        );

        if (raced) {
          return raced;
        }

        throw error;
      }
    }

    const created = await this.createNotificationPrisma8(input);

    return this.requireHydratedNotificationPrisma8(
      created.organizationId,
      created.recipientUserId,
      created.id,
    );
  }

  async processFollowUpNotifications() {
    const rawFollowUps = await db.orm.public.CustomerInternalNote.where({
      kind: CustomerInternalNoteKind.FOLLOW_UP,

      completedAt: null,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'content',
        'assignedToUserId',
        'dueAt',
      )
      .all();

    const followUps = [];

    for (const followUp of rawFollowUps) {
      /*
       * Prisma 7 previously filtered these in SQL.
       * Prisma 8 migration keeps the same behavior
       * explicitly without relying on unproven
       * nullable/relation-filter APIs.
       */
      if (!followUp.assignedToUserId || !followUp.dueAt) {
        continue;
      }

      const customer = await db.orm.public.Customer.where({
        id: followUp.customerId,

        organizationId: followUp.organizationId,
      })
        .select('id', 'archivedAt')
        .first();

      if (!customer || customer.archivedAt) {
        continue;
      }

      const organization = await db.orm.public.Organization.where({
        id: followUp.organizationId,
      })
        .select('timezone')
        .first();

      if (!organization) {
        continue;
      }

      followUps.push({
        id: followUp.id,

        organizationId: followUp.organizationId,

        customerId: followUp.customerId,

        content: followUp.content,

        assignedToUserId: followUp.assignedToUserId,

        dueAt: fromPrisma8Timestamp(followUp.dueAt),

        timezone: organization.timezone,
      });
    }

    followUps.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

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

      try {
        const timezone = followUp.timezone || 'America/Edmonton';

        const todayKey = dateKeyInTimezone(now, timezone);

        const dueDateKey = dateKeyInTimezone(dueAt, timezone);

        if (dueDateKey === todayKey) {
          const dedupeKey = [
            'follow-up-due-today',
            followUp.id,
            recipientUserId,
            todayKey,
          ].join(':');

          const existed = await db.orm.public.Notification.where({
            dedupeKey,
          })
            .select('id')
            .first();

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

          const existed = await db.orm.public.Notification.where({
            dedupeKey,
          })
            .select('id')
            .first();

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

  private async createNotificationPrisma8(input: CreateNotificationInput) {
    return db.orm.public.Notification.create({
      organizationId: input.organizationId,

      recipientUserId: input.recipientUserId,

      actorUserId: input.actorUserId ?? null,

      _type: input.type,

      title: input.title,

      message: input.message,

      href: input.href ?? null,

      customerInternalNoteId: input.customerInternalNoteId ?? null,

      dedupeKey: input.dedupeKey ?? null,

      readAt: null,

      createdAt: toPrisma8Timestamp(),
    });
  }

  private async findNotificationByDedupeKeyPrisma8(dedupeKey: string) {
    const notification = await db.orm.public.Notification.where({
      dedupeKey,
    })
      .select(
        'id',
        'organizationId',
        'recipientUserId',
        'actorUserId',
        '_type',
        'title',
        'message',
        'href',
        'customerInternalNoteId',
        'dedupeKey',
        'readAt',
        'createdAt',
      )
      .first();

    if (!notification) {
      return null;
    }

    return this.hydrateNotificationPrisma8(notification);
  }

  private async requireHydratedNotificationPrisma8(
    organizationId: string,
    recipientUserId: string,
    notificationId: string,
  ) {
    const notification = await db.orm.public.Notification.where({
      id: notificationId,

      organizationId,

      recipientUserId,
    })
      .select(
        'id',
        'organizationId',
        'recipientUserId',
        'actorUserId',
        '_type',
        'title',
        'message',
        'href',
        'customerInternalNoteId',
        'dedupeKey',
        'readAt',
        'createdAt',
      )
      .first();

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.hydrateNotificationPrisma8(notification);
  }

  private async hydrateNotificationPrisma8(notification: {
    id: string;
    organizationId: string;
    recipientUserId: string;
    actorUserId: string | null;
    _type: NotificationType;
    title: string;
    message: string;
    href: string | null;
    customerInternalNoteId: string | null;
    dedupeKey: string | null;
    readAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;
    createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
  }) {
    const actor = notification.actorUserId
      ? await db.orm.public.User.where({
          id: notification.actorUserId,
        })
          .select('id', 'firstName', 'lastName', 'email')
          .first()
      : null;

    return {
      id: notification.id,

      organizationId: notification.organizationId,

      recipientUserId: notification.recipientUserId,

      actorUserId: notification.actorUserId,

      /*
       * Preserve the legacy API response property.
       * Prisma 8 exposes this column as _type.
       */
      type: notification._type,

      title: notification.title,

      message: notification.message,

      href: notification.href,

      customerInternalNoteId: notification.customerInternalNoteId,

      readAt: notification.readAt
        ? fromPrisma8Timestamp(notification.readAt)
        : null,

      createdAt: fromPrisma8Timestamp(notification.createdAt),

      actor,
    };
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
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
