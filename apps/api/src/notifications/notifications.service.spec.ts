jest.mock('@contractflow/db-prisma8', () => {
  const rawBuilder = {
    affectedCount: jest.fn(),
    build: jest.fn(),
  };

  rawBuilder.affectedCount.mockReturnValue(rawBuilder);
  rawBuilder.build.mockReturnValue({
    kind: 'raw-plan',
  });

  return {
    db: {
      transaction: jest.fn(),
      orm: {
        public: {},
      },
      raw: {
        sql: jest.fn(() => rawBuilder),
      },
    },
    fromPrisma8Timestamp: jest.fn((value: unknown) => value),
    isPrisma8UniqueViolation: jest.fn(() => false),
    prisma8TextParam: jest.fn((value: unknown) => value),
    prisma8TimestampParam: jest.fn((value: unknown) => value),
    toPrisma8Timestamp: jest.fn(
      (value: unknown) => value ?? new Date('2026-09-04T16:00:00.000Z'),
    ),
  };
});

import { NotFoundException } from '@nestjs/common';
import { db } from '@contractflow/db-prisma8';

import { NotificationsService } from './notifications.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    first: jest.fn(),
    update: jest.fn(),
  };

  query.where.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.first.mockResolvedValue(result);
  query.update.mockResolvedValue(result);

  return query;
}

describe('NotificationsService Prisma 8 tenant isolation', () => {
  const mockedDb = db as unknown as {
    orm: {
      public: Record<string, unknown>;
    };
  };

  const organizationMemberships = {
    resolveForUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    organizationMemberships.resolveForUser.mockResolvedValue({
      organizationId: 'org_1',
      userId: 'user_1',
    });

    mockedDb.orm.public = {};
  });

  function service() {
    return new NotificationsService(organizationMemberships);
  }

  it('rejects marking a notification from another organization or recipient as read', async () => {
    const notificationQuery = makeQuery(null);

    mockedDb.orm.public.Notification = notificationQuery;

    await expect(
      service().markReadForUser('clerk_1', 'notification_foreign', 'org_1'),
    ).rejects.toThrow(new NotFoundException('Notification not found'));

    expect(notificationQuery.where).toHaveBeenCalledWith({
      id: 'notification_foreign',
      organizationId: 'org_1',
      recipientUserId: 'user_1',
    });
  });
});
