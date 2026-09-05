jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T08:00:00.000Z'),
  ),

  toPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T08:00:00.000Z'),
  ),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { db } from '@contractflow/db-prisma8';

import { CustomersService } from './customers.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),

    select: jest.fn(),

    orderBy: jest.fn(),

    first: jest.fn(),

    all: jest.fn(),

    update: jest.fn(),

    delete: jest.fn(),
  };

  query.where.mockReturnValue(query);

  query.select.mockReturnValue(query);

  query.orderBy.mockReturnValue(query);

  query.first.mockResolvedValue(result);

  query.all.mockResolvedValue(result);

  query.update.mockResolvedValue(result);

  query.delete.mockResolvedValue(result);

  return query;
}

function customer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer_1',

    organizationId: 'org_1',

    firstName: 'Jamie',

    lastName: 'Customer',

    companyName: null,

    email: 'jamie@example.com',

    phone: null,

    notes: null,

    archivedAt: null,

    createdAt: new Date('2026-09-01T08:00:00.000Z'),

    updatedAt: new Date('2026-09-01T08:00:00.000Z'),

    ...overrides,
  };
}

describe('CustomersService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    orm: {
      public: Record<string, unknown>;
    };
  };

  const membership = {
    organizationId: 'org_1',

    userId: 'user_1',
  };

  const activityService = {
    listCustomerActivity: jest.fn(),
  };

  const communicationsService = {
    listForCustomer: jest.fn(),

    sendEmail: jest.fn(),

    retryFailedGeneralEmail: jest.fn(),
  };

  const memberships = {
    resolveForUser: jest.fn().mockResolvedValue(membership),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    memberships.resolveForUser.mockResolvedValue(membership);
  });

  it('creates a customer and writes CUSTOMER_CREATED in the same transaction', async () => {
    const created = customer({
      firstName: 'Avery',

      lastName: 'Client',

      email: 'avery@example.com',
    });

    const customerCreate = jest.fn().mockResolvedValue(created);

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Customer: {
            create: customerCreate,
          },

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    const result = await service.createForUser(
      'clerk_1',
      {
        firstName: '  Avery  ',

        lastName: ' Client ',

        email: ' AVERY@EXAMPLE.COM ',
      },
      'org_1',
    );

    expect(customerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        firstName: 'Avery',

        lastName: 'Client',

        email: 'avery@example.com',

        archivedAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'CUSTOMER_CREATED',

        title: 'Customer created',

        customerId: 'customer_1',
      }),
    );

    expect(result.firstName).toBe('Avery');
  });

  it('records CUSTOMER_UPDATED only when values change', async () => {
    const existing = customer();

    const updated = customer({
      phone: '555-0100',
    });

    let customerWhereCall = 0;

    const customerModel = {
      where: jest.fn(),
    };

    customerModel.where.mockImplementation(() => {
      customerWhereCall += 1;

      if (customerWhereCall === 1) {
        return makeQuery(existing);
      }

      if (customerWhereCall === 2) {
        return {
          update: jest.fn(),
        };
      }

      return makeQuery(updated);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Customer: customerModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    await service.updateForUser(
      'clerk_1',
      'customer_1',
      {
        phone: '555-0100',
      },
      'org_1',
    );

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'CUSTOMER_UPDATED',

        metadata: {
          changes: {
            phone: {
              oldValue: null,

              newValue: '555-0100',
            },
          },
        },
      }),
    );
  });

  it('does not write CUSTOMER_UPDATED activity for a no-op update', async () => {
    const existing = customer();

    let customerWhereCall = 0;

    const customerModel = {
      where: jest.fn(),
    };

    customerModel.where.mockImplementation(() => {
      customerWhereCall += 1;

      if (customerWhereCall === 2) {
        return {
          update: jest.fn(),
        };
      }

      return makeQuery(existing);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Customer: customerModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    await service.updateForUser('clerk_1', 'customer_1', {}, 'org_1');

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('archives and records CUSTOMER_ARCHIVED', async () => {
    const existing = customer();

    const archived = customer({
      archivedAt: new Date('2026-09-04T08:00:00.000Z'),
    });

    let customerWhereCall = 0;

    const update = jest.fn();

    const customerModel = {
      where: jest.fn(),
    };

    customerModel.where.mockImplementation(() => {
      customerWhereCall += 1;

      if (customerWhereCall === 1) {
        return makeQuery(existing);
      }

      if (customerWhereCall === 2) {
        return {
          update,
        };
      }

      return makeQuery(archived);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Customer: customerModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    const result = await service.archiveForUser(
      'clerk_1',
      'customer_1',
      'org_1',
    );

    expect(update).toHaveBeenCalledTimes(1);

    const updateCalls = update.mock.calls as Array<[{ archivedAt?: unknown }]>;
    const updateArg = updateCalls[0]?.[0];

    expect(updateArg?.archivedAt).toBeInstanceOf(Date);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'CUSTOMER_ARCHIVED',
      }),
    );

    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  it('restores and records CUSTOMER_RESTORED', async () => {
    const archived = customer({
      archivedAt: new Date('2026-09-04T08:00:00.000Z'),
    });

    const restored = customer();

    let customerWhereCall = 0;

    const update = jest.fn();

    const customerModel = {
      where: jest.fn(),
    };

    customerModel.where.mockImplementation(() => {
      customerWhereCall += 1;

      if (customerWhereCall === 1) {
        return makeQuery(archived);
      }

      if (customerWhereCall === 2) {
        return {
          update,
        };
      }

      return makeQuery(restored);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Customer: customerModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    const result = await service.restoreForUser(
      'clerk_1',
      'customer_1',
      'org_1',
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        archivedAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'CUSTOMER_RESTORED',
      }),
    );

    expect(result.archivedAt).toBeNull();
  });

  it('rejects sending email to an archived customer', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery(
        customer({
          archivedAt: new Date('2026-09-04T08:00:00.000Z'),
        }),
      ),
    };

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    await expect(
      service.sendCommunicationForUser(
        'clerk_1',
        'customer_1',
        {
          subject: 'Hello',

          message: 'Test',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      new BadRequestException('Archived customers cannot be emailed'),
    );

    expect(communicationsService.sendEmail).not.toHaveBeenCalled();
  });

  it('rejects sending email when customer has no email', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery(
        customer({
          email: null,
        }),
      ),
    };

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    await expect(
      service.sendCommunicationForUser(
        'clerk_1',
        'customer_1',
        {
          subject: 'Hello',

          message: 'Test',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Customer must have an email address before a message can be sent',
    );
  });

  it('throws Customer not found for an invalid organization/customer pair', async () => {
    mockedDb.orm.public = {
      Customer: makeQuery(null),
    };

    const service = new CustomersService(
      activityService as never,
      communicationsService as never,
      memberships,
    );

    await expect(
      service.getByIdForUser('clerk_1', 'missing_customer', 'org_1'),
    ).rejects.toThrow(new NotFoundException('Customer not found'));
  });
});
