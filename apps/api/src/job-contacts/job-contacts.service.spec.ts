jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    raw: {
      sql: jest.fn(),
    },
    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-01-01T00:00:00.000Z'),
  ),

  prisma8TimestampParam: jest.fn((value: unknown) => value),

  toPrisma8Timestamp: jest.fn(() => new Date('2026-01-02T12:00:00.000Z')),
}));

import { db } from '@contractflow/db-prisma8';

import { JobContactsService } from './job-contacts.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    first: jest.fn(),
    all: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  query.where.mockReturnValue(query);
  query.select.mockReturnValue(query);

  query.first.mockResolvedValue(result);
  query.all.mockResolvedValue(result);

  query.update.mockResolvedValue(result);
  query.delete.mockResolvedValue(result);

  return query;
}

describe('JobContactsService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    raw: {
      sql: jest.Mock;
    };

    orm: {
      public: Record<string, unknown>;
    };
  };

  const membership = {
    organizationId: 'org_1',
    userId: 'user_1',
  };

  const organizationMemberships = {
    resolveForUser: jest.fn().mockResolvedValue(membership),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    organizationMemberships.resolveForUser.mockResolvedValue(membership);
  });

  it('preserves primary-first then alphabetical ordering', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const contactsQuery = makeQuery([
      {
        id: 'contact_3',
        organizationId: 'org_1',
        jobId: 'job_1',
        firstName: 'Zoe',
        lastName: null,
        phone: null,
        email: null,
        role: null,
        notes: null,
        isPrimary: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'contact_1',
        organizationId: 'org_1',
        jobId: 'job_1',
        firstName: 'Mary',
        lastName: 'Smith',
        phone: null,
        email: null,
        role: null,
        notes: null,
        isPrimary: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'contact_2',
        organizationId: 'org_1',
        jobId: 'job_1',
        firstName: 'Adam',
        lastName: 'Jones',
        phone: null,
        email: null,
        role: null,
        notes: null,
        isPrimary: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockedDb.orm.public = {
      Job: jobQuery,
      JobContact: contactsQuery,
    };

    const service = new JobContactsService(organizationMemberships);

    const result = await service.listForJobForUser('clerk_1', 'job_1');

    expect(result.map((contact) => contact.id)).toEqual([
      'contact_1',
      'contact_2',
      'contact_3',
    ]);
  });

  it('uses raw SQL to demote current primaries before creating a new primary', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const contact = {
      id: 'contact_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      email: null,
      role: null,
      notes: null,
      isPrimary: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const contactCreate = jest.fn().mockResolvedValue(contact);

    const activityCreate = jest.fn();

    const execute = jest.fn().mockResolvedValue({
      affectedRows: 2,
    });

    const tx = {
      execute,

      orm: {
        public: {
          Job: jobQuery,

          JobContact: {
            create: contactCreate,
          },

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const build = jest.fn().mockReturnValue('demote-plan');

    const affectedCount = jest.fn().mockReturnValue({
      build,
    });

    mockedDb.raw.sql.mockReturnValue({
      affectedCount,
    });

    const service = new JobContactsService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      firstName: '  Jane  ',
      lastName: '  Doe  ',
      isPrimary: true,
    });

    expect(mockedDb.raw.sql).toHaveBeenCalledTimes(1);

    expect(affectedCount).toHaveBeenCalledTimes(1);

    expect(execute).toHaveBeenCalledWith('demote-plan');

    expect(contactCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        jobId: 'job_1',

        firstName: 'Jane',

        lastName: 'Doe',

        isPrimary: true,
      }),
    );

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'JOB_CONTACT_CREATED',

        customerId: 'customer_1',

        actorUserId: 'user_1',
      }),
    );

    expect(result.isPrimary).toBe(true);
  });

  it('uses raw SQL before setting an existing contact primary', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'contact_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      firstName: 'Jane',
      lastName: 'Doe',
      phone: null,
      email: null,
      role: null,
      notes: null,
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updated = {
      ...existing,
      isPrimary: true,
    };

    let whereCall = 0;

    const contactModel = {
      where: jest.fn(),
    };

    contactModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: jest.fn().mockResolvedValue(updated),
        };
      }

      return makeQuery(updated);
    });

    const activityCreate = jest.fn();

    const execute = jest.fn().mockResolvedValue({
      affectedRows: 1,
    });

    const tx = {
      execute,

      orm: {
        public: {
          Job: jobQuery,
          JobContact: contactModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue('demote-plan'),
      }),
    });

    const service = new JobContactsService(organizationMemberships);

    const result = await service.setPrimaryForUser(
      'clerk_1',
      'job_1',
      'contact_1',
    );

    expect(execute).toHaveBeenCalledWith('demote-plan');

    expect(result.isPrimary).toBe(true);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'JOB_CONTACT_UPDATED',

        title: 'Primary job contact changed',
      }),
    );
  });
});
