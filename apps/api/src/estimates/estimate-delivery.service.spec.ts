jest.mock('@contractflow/invoice-pdf', () => ({
  createEstimatePdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
}));

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
  };
});

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { db } from '@contractflow/db-prisma8';

import { EstimateDeliveryService } from './estimate-delivery.service';

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

    jobId: 'job_1',

    number: 'EST-1001',

    status: 'DRAFT',

    title: 'Test Estimate',

    notes: null,

    terms: null,

    validUntil: new Date('2099-12-31T00:00:00.000Z'),

    currency: 'CAD',

    subtotalCents: 10000,

    discountCents: 0,

    taxRate: {
      toString: () => '0.0500',
    },

    taxCents: 500,

    totalCents: 10500,

    updatedAt: new Date('2026-09-04T12:00:00.000Z'),

    publicAccessToken: null,

    ...overrides,
  };
}

function customerRecord(overrides: Record<string, unknown> = {}) {
  return {
    firstName: 'Test',

    lastName: 'Customer',

    companyName: null,

    email: 'customer@example.com',

    phone: '555-5555',

    ...overrides,
  };
}

function organizationRecord() {
  return {
    name: 'ContractFlow Test',

    legalName: 'ContractFlow Test Ltd.',

    email: 'office@example.com',

    phone: '555-1000',

    addressLine1: '1 Test Street',

    addressLine2: null,

    city: 'Edmonton',

    province: 'AB',

    postalCode: 'T1T 1T1',

    country: 'CA',

    taxNumber: null,

    website: null,

    currency: 'CAD',
  };
}

function lineItemRecord() {
  return {
    description: 'Test work',

    quantity: {
      toString: () => '1.0000',
    },

    unitPriceCents: 10000,

    lineTotalCents: 10000,

    position: 0,
  };
}

describe('EstimateDeliveryService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    orm: {
      public: Record<string, unknown>;
    };
  };

  const configService = {
    get: jest.fn(() => 'https://app.example.com'),
  };

  const customerCommunicationsService = {
    sendEmail: jest.fn(),
  };

  const estimatesService = {
    getByIdForUser: jest.fn(),
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

    estimatesService.getByIdForUser.mockResolvedValue({
      id: 'estimate_1',

      status: 'SENT',
    });

    customerCommunicationsService.sendEmail.mockResolvedValue(undefined);
  });

  function buildService() {
    return new EstimateDeliveryService(
      configService as never,
      customerCommunicationsService as never,
      estimatesService as never,
      organizationMemberships,
    );
  }

  function setCommonQueries(estimate = estimateRecord()) {
    mockedDb.orm.public = {
      Estimate: makeQuery(estimate),

      Customer: makeQuery(customerRecord()),

      Job: makeQuery({
        name: 'Test Job',
      }),

      Organization: makeQuery(organizationRecord()),

      EstimateLineItem: makeQuery([lineItemRecord()]),
    };
  }

  it('rejects an estimate outside the organization scope', async () => {
    mockedDb.orm.public = {
      Estimate: makeQuery(null),
    };

    const service = buildService();

    await expect(
      service.sendForUser('clerk_1', 'missing_estimate'),
    ).rejects.toThrow(new NotFoundException('Estimate not found'));
  });

  it('rejects non-draft estimates', async () => {
    setCommonQueries(
      estimateRecord({
        status: 'SENT',
      }),
    );

    const service = buildService();

    await expect(service.sendForUser('clerk_1', 'estimate_1')).rejects.toThrow(
      new BadRequestException('Only draft estimates can be sent'),
    );
  });

  it('rejects expired estimates', async () => {
    setCommonQueries(
      estimateRecord({
        validUntil: new Date('2020-01-01T00:00:00.000Z'),
      }),
    );

    const service = buildService();

    await expect(service.sendForUser('clerk_1', 'estimate_1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects customers without an email address', async () => {
    mockedDb.orm.public = {
      Estimate: makeQuery(estimateRecord()),

      Customer: makeQuery(
        customerRecord({
          email: null,
        }),
      ),

      Job: makeQuery({
        name: 'Test Job',
      }),

      Organization: makeQuery(organizationRecord()),

      EstimateLineItem: makeQuery([lineItemRecord()]),
    };

    const service = buildService();

    await expect(service.sendForUser('clerk_1', 'estimate_1')).rejects.toThrow(
      new BadRequestException(
        'Customer must have an email address before the estimate can be sent',
      ),
    );
  });

  it('uses the pre-send updatedAt in the email idempotency key', async () => {
    setCommonQueries();

    let transactionCalls = 0;

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionCalls += 1;

        if (transactionCalls === 1) {
          return callback({
            execute: jest.fn().mockResolvedValue({
              affectedRows: 1,
            }),

            orm: {
              public: {},
            },
          });
        }

        return callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: 1,
          }),

          orm: {
            public: {
              CustomerActivity: {
                create: jest.fn().mockResolvedValue({
                  id: 'activity_1',
                }),
              },
            },
          },
        });
      },
    );

    const service = buildService();

    await service.sendForUser('clerk_1', 'estimate_1');

    expect(customerCommunicationsService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'estimate-send/estimate_1/2026-09-04T12:00:00.000Z',
      }),
    );
  });

  it('writes ESTIMATE_SENT in the same transaction as DRAFT to SENT', async () => {
    setCommonQueries();

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    let transactionCalls = 0;

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionCalls += 1;

        if (transactionCalls === 1) {
          return callback({
            execute: jest.fn().mockResolvedValue({
              affectedRows: 1,
            }),

            orm: {
              public: {},
            },
          });
        }

        return callback({
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
        });
      },
    );

    const service = buildService();

    await service.sendForUser('clerk_1', 'estimate_1');

    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        customerId: 'customer_1',
        actorUserId: 'user_1',
        _type: 'ESTIMATE_SENT',
        metadata: {
          estimateId: 'estimate_1',
          estimateNumber: 'EST-1001',
          totalCents: 10500,
          source: 'estimate_email',
        },
      }),
    );
  });

  it('rejects when DRAFT to SENT affects zero rows', async () => {
    setCommonQueries();

    let transactionCalls = 0;

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        transactionCalls += 1;

        return callback({
          execute: jest.fn().mockResolvedValue({
            affectedRows: transactionCalls === 1 ? 1 : 0,
          }),

          orm: {
            public: {
              CustomerActivity: {
                create: jest.fn(),
              },
            },
          },
        });
      },
    );

    const service = buildService();

    await expect(service.sendForUser('clerk_1', 'estimate_1')).rejects.toThrow(
      new BadRequestException('Estimate could not be marked as sent'),
    );
  });
});
