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

    fromPrisma8Timestamp: jest.fn((value) =>
      value instanceof Date ? value : new Date('2026-09-04T12:00:00.000Z'),
    ),

    toPrisma8Timestamp: jest.fn((value) =>
      value instanceof Date ? value : new Date('2026-09-04T12:00:00.000Z'),
    ),

    prisma8TextParam: jest.fn((value: unknown) => value),

    prisma8TimestampParam: jest.fn((value: unknown) => value),

    isPrisma8UniqueViolation: jest.fn(
      (error) => error instanceof Error && error.message === 'unique',
    ),
  };
});

import { EstimateReminderType, EstimateStatus } from '@contractflow/db';

import { db } from '@contractflow/db-prisma8';

import { EstimateRemindersService } from './estimate-reminders.service';

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

function estimateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate_1',

    organizationId: 'org_1',

    customerId: 'customer_1',

    number: 'EST-1001',

    status: 'SENT',

    sentAt: new Date('2026-09-01T12:00:00.000Z'),

    validUntil: new Date('2099-12-31T00:00:00.000Z'),

    totalCents: 10500,

    currency: 'CAD',

    publicAccessToken: 'public-token',

    ...overrides,
  };
}

describe('EstimateRemindersService Prisma 8', () => {
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
    get: jest.fn(() => 'https://app.example.com'),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    customerCommunicationsService.sendEmail.mockResolvedValue(undefined);
  });

  function buildService() {
    return new EstimateRemindersService(
      customerCommunicationsService as never,
      configService as never,
    );
  }

  function installCommonModels() {
    mockedDb.orm.public = {
      Organization: makeQuery({
        name: 'ContractFlow Test',

        legalName: 'ContractFlow Test Ltd.',

        email: 'office@example.com',

        timezone: 'America/Edmonton',

        currency: 'CAD',
      }),

      EstimateReminderSettings: makeQuery({
        enabled: true,

        firstFollowUpEnabled: true,

        firstFollowUpDays: 3,

        secondFollowUpEnabled: true,

        secondFollowUpDays: 7,
      }),

      Estimate: makeQuery(estimateRecord()),

      Customer: makeQuery({
        firstName: 'Test',

        lastName: 'Customer',

        companyName: null,

        email: 'customer@example.com',
      }),

      EstimateReminder: makeQuery(null),
    };
  }

  it('processes organizations in Prisma 8', async () => {
    const organizationsQuery = makeQuery([
      {
        id: 'org_1',

        createdAt: new Date(),
      },
    ]);

    mockedDb.orm.public = {
      Organization: organizationsQuery,
    };

    const service = buildService();

    jest.spyOn(service, 'processOrganization').mockResolvedValue({
      organizationId: 'org_1',

      scanned: 2,

      remindersSent: 1,

      skipped: 1,

      failures: [],
    });

    const result = await service.processAllOrganizations();

    expect(result).toMatchObject({
      organizationsScanned: 1,

      organizationsProcessed: 1,

      estimatesScanned: 2,

      remindersSent: 1,

      skipped: 1,
    });
  });

  it('skips estimates with no customer email', async () => {
    installCommonModels();

    mockedDb.orm.public.Customer = makeQuery({
      firstName: 'Test',

      lastName: 'Customer',

      companyName: null,

      email: null,
    });

    const sentQuery = makeQuery([estimateRecord()]);

    const viewedQuery = makeQuery([]);

    let estimateCall = 0;

    mockedDb.orm.public.Estimate = {
      where: jest.fn(() => {
        estimateCall += 1;

        return estimateCall === 1 ? sentQuery : viewedQuery;
      }),
    };

    const service = buildService();

    const result = await service.processOrganization('org_1');

    expect(result.scanned).toBe(0);

    expect(result.remindersSent).toBe(0);
  });

  it('uses second follow-up catch-up before first follow-up', () => {
    const service = buildService();

    const decision = (
      service as unknown as {
        getReminderDecision: (input: {
          settings: {
            enabled: boolean;
            firstFollowUpEnabled: boolean;
            firstFollowUpDays: number;
            secondFollowUpEnabled: boolean;
            secondFollowUpDays: number;
          };

          sentDateKey: string;
          daysSinceSent: number;
        }) => {
          type: EstimateReminderType;
        } | null;
      }
    ).getReminderDecision({
      settings: {
        enabled: true,

        firstFollowUpEnabled: true,

        firstFollowUpDays: 3,

        secondFollowUpEnabled: true,

        secondFollowUpDays: 7,
      },

      sentDateKey: '2026-08-20',

      daysSinceSent: 10,
    });

    expect(decision?.type).toBe(EstimateReminderType.SECOND_FOLLOW_UP);
  });

  it('returns an existing reminder without creating a duplicate', async () => {
    installCommonModels();

    mockedDb.orm.public.EstimateReminder = makeQuery({
      id: 'reminder_1',

      sentAt: null,
    });

    const service = buildService();

    const result = await (
      service as unknown as {
        ensureReminder: (input: {
          organizationId: string;
          estimateId: string;
          type: EstimateReminderType;
          scheduledFor: Date;
        }) => Promise<{
          id: string;
        }>;
      }
    ).ensureReminder({
      organizationId: 'org_1',

      estimateId: 'estimate_1',

      type: EstimateReminderType.FIRST_FOLLOW_UP,

      scheduledFor: new Date(),
    });

    expect(result.id).toBe('reminder_1');

    expect(mockedDb.transaction).not.toHaveBeenCalled();
  });

  it('falls back to the unique-constraint winner during concurrent reminder creation', async () => {
    let lookupCount = 0;

    const reminderModel = {
      where: jest.fn(() => {
        lookupCount += 1;

        return makeQuery(
          lookupCount === 1
            ? null
            : {
                id: 'winner_reminder',

                sentAt: null,
              },
        );
      }),
    };

    mockedDb.orm.public = {
      EstimateReminder: reminderModel,
    };

    mockedDb.transaction.mockRejectedValue(new Error('unique'));

    const service = buildService();

    const result = await (
      service as unknown as {
        ensureReminder: (input: {
          organizationId: string;
          estimateId: string;
          type: EstimateReminderType;
          scheduledFor: Date;
        }) => Promise<{
          id: string;
        }>;
      }
    ).ensureReminder({
      organizationId: 'org_1',

      estimateId: 'estimate_1',

      type: EstimateReminderType.FIRST_FOLLOW_UP,

      scheduledFor: new Date(),
    });

    expect(result.id).toBe('winner_reminder');
  });

  it('does not send when lifecycle re-check changes status', async () => {
    installCommonModels();

    mockedDb.orm.public.Estimate = makeQuery({
      id: 'estimate_1',

      status: 'APPROVED',

      validUntil: null,

      publicAccessToken: 'public-token',
    });

    const service = buildService();

    const estimate = {
      ...estimateRecord(),

      status: 'SENT' as const,

      sentAt: new Date('2026-08-20T00:00:00.000Z'),

      validUntil: new Date('2099-12-31T00:00:00.000Z'),

      publicAccessToken: 'public-token',

      customer: {
        firstName: 'Test',

        lastName: 'Customer',

        companyName: null,

        email: 'customer@example.com',
      },

      organization: {
        name: 'ContractFlow Test',

        legalName: null,

        email: 'office@example.com',

        timezone: 'America/Edmonton',

        currency: 'CAD',

        estimateReminderSettings: {
          enabled: true,

          firstFollowUpEnabled: true,

          firstFollowUpDays: 3,

          secondFollowUpEnabled: true,

          secondFollowUpDays: 7,
        },
      },
    };

    const result = await (
      service as unknown as {
        processEstimate: (input: typeof estimate) => Promise<boolean>;
      }
    ).processEstimate(estimate);

    expect(result).toBe(false);

    expect(customerCommunicationsService.sendEmail).not.toHaveBeenCalled();
  });

  it('marks reminder sent and writes ESTIMATE_SENT activity in the same transaction', async () => {
    installCommonModels();

    const currentQuery = makeQuery({
      id: 'estimate_1',

      status: EstimateStatus.SENT,

      validUntil: new Date('2099-12-31T00:00:00.000Z'),

      publicAccessToken: 'public-token',
    });

    mockedDb.orm.public.Estimate = currentQuery;

    mockedDb.orm.public.EstimateReminder = makeQuery({
      id: 'reminder_1',

      sentAt: null,
    });

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

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

    const service = buildService();

    const estimate = {
      ...estimateRecord(),

      sentAt: new Date('2026-08-20T00:00:00.000Z'),

      validUntil: new Date('2099-12-31T00:00:00.000Z'),

      status: 'SENT' as const,

      publicAccessToken: 'public-token',

      customer: {
        firstName: 'Test',

        lastName: 'Customer',

        companyName: null,

        email: 'customer@example.com',
      },

      organization: {
        name: 'ContractFlow Test',

        legalName: null,

        email: 'office@example.com',

        timezone: 'America/Edmonton',

        currency: 'CAD',

        estimateReminderSettings: {
          enabled: true,

          firstFollowUpEnabled: true,

          firstFollowUpDays: 3,

          secondFollowUpEnabled: true,

          secondFollowUpDays: 7,
        },
      },
    };

    const result = await (
      service as unknown as {
        processEstimate: (input: typeof estimate) => Promise<boolean>;
      }
    ).processEstimate(estimate);

    expect(result).toBe(true);

    expect(customerCommunicationsService.sendEmail).toHaveBeenCalledTimes(1);

    const sendEmailCalls = customerCommunicationsService.sendEmail.mock
      .calls as Array<
      [
        {
          idempotencyKey?: unknown;
        },
      ]
    >;
    const sendEmailArg = sendEmailCalls[0]?.[0];

    expect(typeof sendEmailArg?.idempotencyKey).toBe('string');
    expect(sendEmailArg?.idempotencyKey).toEqual(
      expect.stringContaining('estimate-reminder/estimate_1/'),
    );

    expect(createActivity).toHaveBeenCalledTimes(1);

    const createActivityCalls = createActivity.mock.calls as Array<
      [
        {
          organizationId?: string;
          customerId?: string;
          actorUserId?: string | null;
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createActivityArg = createActivityCalls[0]?.[0];

    expect(createActivityArg).toMatchObject({
      organizationId: 'org_1',
      customerId: 'customer_1',
      actorUserId: null,
      _type: 'ESTIMATE_SENT',
    });

    expect(createActivityArg?.metadata).toMatchObject({
      estimateId: 'estimate_1',
      source: 'estimate_reminder_engine',
    });
  });

  it('does not write activity when sentAt compare-and-set loses', async () => {
    installCommonModels();

    mockedDb.orm.public.Estimate = makeQuery({
      id: 'estimate_1',

      status: EstimateStatus.SENT,

      validUntil: new Date('2099-12-31T00:00:00.000Z'),

      publicAccessToken: 'public-token',
    });

    mockedDb.orm.public.EstimateReminder = makeQuery({
      id: 'reminder_1',

      sentAt: null,
    });

    const createActivity = jest.fn();

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 0,
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

    const service = buildService();

    const estimate = {
      ...estimateRecord(),

      sentAt: new Date('2026-08-20T00:00:00.000Z'),

      validUntil: new Date('2099-12-31T00:00:00.000Z'),

      status: 'SENT' as const,

      publicAccessToken: 'public-token',

      customer: {
        firstName: 'Test',

        lastName: 'Customer',

        companyName: null,

        email: 'customer@example.com',
      },

      organization: {
        name: 'ContractFlow Test',

        legalName: null,

        email: 'office@example.com',

        timezone: 'America/Edmonton',

        currency: 'CAD',

        estimateReminderSettings: {
          enabled: true,

          firstFollowUpEnabled: true,

          firstFollowUpDays: 3,

          secondFollowUpEnabled: true,

          secondFollowUpDays: 7,
        },
      },
    };

    const result = await (
      service as unknown as {
        processEstimate: (input: typeof estimate) => Promise<boolean>;
      }
    ).processEstimate(estimate);

    /*
     * Preserve original behavior:
     * email already succeeded, so the method
     * returns true even though another worker
     * won the sentAt claim.
     */
    expect(result).toBe(true);

    expect(createActivity).not.toHaveBeenCalled();
  });
});
