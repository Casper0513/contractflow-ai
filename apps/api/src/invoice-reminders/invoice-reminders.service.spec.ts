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

    toPrisma8Timestamp: jest.fn(
      (value: unknown) => value ?? new Date('2026-09-04T16:00:00.000Z'),
    ),

    prisma8TextParam: jest.fn((value: unknown) => value),

    prisma8TimestampParam: jest.fn((value: unknown) => value),

    isPrisma8UniqueViolation: jest.fn(() => false),
  };
});

import { InvoiceStatus } from '@contractflow/db';
import { db, isPrisma8UniqueViolation } from '@contractflow/db-prisma8';

import { InvoiceRemindersService } from './invoice-reminders.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
    all: jest.fn(),
  };

  query.where.mockReturnValue(query);

  query.select.mockReturnValue(query);

  query.orderBy.mockReturnValue(query);

  query.first.mockResolvedValue(result);

  query.all.mockResolvedValue(result);

  return query;
}

describe('InvoiceRemindersService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    orm: {
      public: Record<string, unknown>;
    };
  };

  const customerCommunicationsService = {
    sendEmail: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const organizationMemberships = {
    resolveForUser: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockedDb.orm.public = {};

    organizationMemberships.resolveForUser.mockResolvedValue({
      organizationId: 'org_1',

      userId: 'user_1',
    });

    configService.get.mockReturnValue('https://example.test');
  });

  function service() {
    return new InvoiceRemindersService(
      customerCommunicationsService as never,
      configService as never,
      organizationMemberships,
    );
  }

  it('skips an ineligible invoice', async () => {
    const invoiceQuery = makeQuery({
      id: 'invoice_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      number: 'INV-00001',

      status: InvoiceStatus.PAID,

      currency: 'CAD',

      dueDate: new Date('2026-09-01T00:00:00.000Z'),

      totalCents: 1000,

      amountPaidCents: 1000,

      balanceDueCents: 0,

      publicAccessToken: 'token_1',
    });

    mockedDb.orm.public.Invoice = invoiceQuery;

    mockedDb.orm.public.Customer = makeQuery({
      firstName: 'Test',

      lastName: 'Customer',

      companyName: null,

      email: 'test@example.com',
    });

    mockedDb.orm.public.Organization = makeQuery({
      name: 'Test Co',

      legalName: null,

      email: null,

      timezone: 'America/Edmonton',
    });

    mockedDb.orm.public.InvoiceReminderSettings = makeQuery(null);

    const result = await service().processInvoiceForUser(
      'clerk_1',
      'invoice_1',
    );

    expect(result).toEqual({
      invoiceId: 'invoice_1',

      reminderSent: false,

      overdueMarked: false,
    });

    expect(customerCommunicationsService.sendEmail).not.toHaveBeenCalled();
  });

  it('reuses an already-sent reminder and skips email', async () => {
    const invoiceQuery = makeQuery({
      id: 'invoice_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      number: 'INV-00001',

      status: InvoiceStatus.SENT,

      currency: 'CAD',

      dueDate: new Date(),

      totalCents: 1000,

      amountPaidCents: 0,

      balanceDueCents: 1000,

      publicAccessToken: 'token_1',
    });

    mockedDb.orm.public.Invoice = invoiceQuery;

    mockedDb.orm.public.Customer = makeQuery({
      firstName: 'Test',

      lastName: 'Customer',

      companyName: null,

      email: 'test@example.com',
    });

    mockedDb.orm.public.Organization = makeQuery({
      name: 'Test Co',

      legalName: null,

      email: null,

      timezone: 'America/Edmonton',
    });

    mockedDb.orm.public.InvoiceReminderSettings = makeQuery({
      enabled: true,

      beforeDueEnabled: true,

      beforeDueDays: 3,

      dueTodayEnabled: true,

      firstOverdueEnabled: true,

      firstOverdueDays: 3,

      secondOverdueEnabled: true,

      secondOverdueDays: 7,
    });

    const reminderQuery = makeQuery({
      id: 'reminder_1',

      sentAt: new Date(),
    });

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          orm: {
            public: {
              InvoiceReminder: reminderQuery,
            },
          },
        }),
    );

    const result = await service().processInvoiceForUser(
      'clerk_1',
      'invoice_1',
    );

    expect(result.reminderSent).toBe(false);

    expect(customerCommunicationsService.sendEmail).not.toHaveBeenCalled();
  });

  it('creates a reminder and marks it sent after email delivery', async () => {
    const invoiceQuery = makeQuery({
      id: 'invoice_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      number: 'INV-00001',

      status: InvoiceStatus.SENT,

      currency: 'CAD',

      dueDate: new Date(),

      totalCents: 1000,

      amountPaidCents: 0,

      balanceDueCents: 1000,

      publicAccessToken: 'token_1',
    });

    mockedDb.orm.public.Invoice = invoiceQuery;

    mockedDb.orm.public.Customer = makeQuery({
      firstName: 'Test',

      lastName: 'Customer',

      companyName: null,

      email: 'test@example.com',
    });

    mockedDb.orm.public.Organization = makeQuery({
      name: 'Test Co',

      legalName: 'Test Company',

      email: 'billing@example.com',

      timezone: 'America/Edmonton',
    });

    mockedDb.orm.public.InvoiceReminderSettings = makeQuery({
      enabled: true,

      beforeDueEnabled: true,

      beforeDueDays: 3,

      dueTodayEnabled: true,

      firstOverdueEnabled: true,

      firstOverdueDays: 3,

      secondOverdueEnabled: true,

      secondOverdueDays: 7,
    });

    const existingReminder = makeQuery(null);

    const createReminder = jest.fn().mockResolvedValue({
      id: 'reminder_1',

      sentAt: null,
    });

    const execute = jest.fn().mockResolvedValue({
      affectedRows: 1,
    });

    mockedDb.transaction
      .mockImplementationOnce(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            orm: {
              public: {
                InvoiceReminder: {
                  where: existingReminder.where,

                  create: createReminder,
                },
              },
            },
          }),
      )
      .mockImplementationOnce(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            execute,
          }),
      );

    customerCommunicationsService.sendEmail.mockResolvedValue(undefined);

    const result = await service().processInvoiceForUser(
      'clerk_1',
      'invoice_1',
    );

    expect(result.reminderSent).toBe(true);

    expect(customerCommunicationsService.sendEmail).toHaveBeenCalledTimes(1);

    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('fetches the winner after a reminder unique conflict', async () => {
    const uniqueViolation = isPrisma8UniqueViolation as jest.Mock;

    uniqueViolation.mockReturnValue(true);

    const existingQuery = makeQuery(null);

    const winnerQuery = makeQuery({
      id: 'reminder_winner',

      sentAt: null,
    });

    const create = jest.fn().mockRejectedValue(new Error('unique violation'));

    const invoiceReminder = {
      where: jest
        .fn()
        .mockReturnValueOnce(existingQuery)
        .mockReturnValueOnce(winnerQuery),

      create,
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          orm: {
            public: {
              InvoiceReminder: invoiceReminder,
            },
          },
        }),
    );

    const internals = service() as unknown as {
      createOrGetReminder(
        organizationId: string,
        invoiceId: string,
        decision: {
          type: string;
          scheduledFor: Date;
        },
      ): Promise<{
        id: string;
        sentAt: Date | null;
      }>;
    };

    const result = await internals.createOrGetReminder('org_1', 'invoice_1', {
      type: 'DUE_TODAY',

      scheduledFor: new Date(),
    });

    expect(result).toEqual({
      id: 'reminder_winner',

      sentAt: null,
    });
  });

  it('returns false when overdue CAS loses the race', async () => {
    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 0,
          }),

          orm: {
            public: {
              CustomerActivity: {
                create: jest.fn(),
              },
            },
          },
        }),
    );

    const internals = service() as unknown as {
      markOverdueIfNeeded(invoice: unknown): Promise<boolean>;
    };

    const result = await internals.markOverdueIfNeeded({
      id: 'invoice_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      number: 'INV-00001',

      status: InvoiceStatus.SENT,
    });

    expect(result).toBe(false);
  });

  it('writes INVOICE_OVERDUE activity when overdue CAS wins', async () => {
    const createActivity = jest.fn();

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 1,
          }),

          orm: {
            public: {
              CustomerActivity: {
                create: createActivity,
              },
            },
          },
        }),
    );

    const internals = service() as unknown as {
      markOverdueIfNeeded(invoice: unknown): Promise<boolean>;
    };

    const result = await internals.markOverdueIfNeeded({
      id: 'invoice_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      number: 'INV-00001',

      status: InvoiceStatus.VIEWED,
    });

    expect(result).toBe(true);

    expect(createActivity).toHaveBeenCalledTimes(1);

    const createActivityCalls = createActivity.mock.calls as Array<
      [
        {
          _type?: string;
          customerId?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createActivityArg = createActivityCalls[0]?.[0];

    expect(createActivityArg).toMatchObject({
      _type: 'INVOICE_OVERDUE',
      customerId: 'customer_1',
    });

    expect(createActivityArg?.metadata).toMatchObject({
      previousStatus: InvoiceStatus.VIEWED,
      status: InvoiceStatus.OVERDUE,
      source: 'invoice_reminder_engine',
    });
  });
});
