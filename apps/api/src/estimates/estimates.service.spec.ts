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

    toPrisma8Numeric: jest.fn((value: unknown) => value),

    prisma8TextParam: jest.fn((value: unknown) => value),

    prisma8TimestampParam: jest.fn((value: unknown) => value),
  };
});

import { BadRequestException } from '@nestjs/common';
import { EstimateStatus } from '@contractflow/db';
import { db } from '@contractflow/db-prisma8';

import { EstimatesService } from './estimates.service';

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

describe('EstimatesService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

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
    return new EstimatesService(organizationMemberships);
  }

  it('rejects editing a non-draft estimate', async () => {
    const tx = {
      orm: {
        public: {
          Estimate: makeQuery({
            id: 'estimate_1',

            customerId: 'customer_1',

            jobId: null,

            status: EstimateStatus.SENT,

            currency: 'CAD',

            discountCents: 0,

            taxRate: '5.0000',
          }),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().updateForUser('clerk_1', 'estimate_1', {
        title: 'Nope',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preserves DRAFT -> SENT CAS failure semantics', async () => {
    const estimateQuery = makeQuery({
      id: 'estimate_1',

      customerId: 'customer_1',

      jobId: null,

      status: EstimateStatus.DRAFT,

      currency: 'CAD',

      discountCents: 0,

      taxRate: '5.0000',
    });

    const currentStatusQuery = makeQuery({
      status: EstimateStatus.VIEWED,
    });

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 0,
      }),

      orm: {
        public: {
          Estimate: {
            where: jest
              .fn()
              .mockReturnValueOnce(estimateQuery)
              .mockReturnValueOnce(currentStatusQuery),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().sendForUser('clerk_1', 'estimate_1'),
    ).rejects.toThrow('Estimate cannot transition from VIEWED to SENT');
  });

  it('writes transition activity after successful SENT CAS', async () => {
    const existingQuery = makeQuery({
      id: 'estimate_1',

      customerId: 'customer_1',

      jobId: null,

      status: EstimateStatus.DRAFT,

      currency: 'CAD',

      discountCents: 0,

      taxRate: '5.0000',
    });

    const hydratedEstimate = {
      id: 'estimate_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      jobId: null,

      createdByUserId: null,

      number: 'EST-00001',

      status: EstimateStatus.SENT,

      title: null,

      notes: null,

      terms: null,

      currency: 'CAD',

      validUntil: null,

      subtotalCents: 1000,

      discountCents: 0,

      taxRate: '5.0000',

      taxCents: 50,

      totalCents: 1050,

      sentAt: new Date(),

      viewedAt: null,

      approvedAt: null,

      declinedAt: null,

      expiredAt: null,

      createdAt: new Date(),

      updatedAt: new Date(),

      customer: {
        id: 'customer_1',
      },

      job: null,

      createdBy: null,

      lineItems: [],
    };

    const estimateHydrateQuery = makeQuery(hydratedEstimate);

    const createActivity = jest.fn();

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 1,
      }),

      orm: {
        public: {
          Estimate: {
            where: jest
              .fn()
              .mockReturnValueOnce(existingQuery)
              .mockReturnValueOnce(estimateHydrateQuery),
          },

          Customer: makeQuery({
            id: 'customer_1',

            firstName: 'Test',

            lastName: 'Customer',

            companyName: null,

            email: null,

            phone: null,
          }),

          EstimateLineItem: makeQuery([]),

          CustomerActivity: {
            create: createActivity,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await service().sendForUser('clerk_1', 'estimate_1');

    expect(createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'ESTIMATE_SENT',

        customerId: 'customer_1',
      }),
    );
  });

  it('rejects duplicate imported materials', async () => {
    const tx = {
      orm: {
        public: {
          Estimate: makeQuery({
            id: 'estimate_1',

            customerId: 'customer_1',

            jobId: 'job_1',

            status: EstimateStatus.DRAFT,

            currency: 'CAD',

            discountCents: 0,

            taxRate: '5.0000',
          }),

          EstimateLineItem: makeQuery([
            {
              id: 'line_1',

              description: 'Material',

              quantity: '1.0000',

              unitPriceCents: 500,

              lineTotalCents: 500,

              position: 0,

              sourceJobMaterialId: 'material_1',
            },
          ]),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().addMaterialsForUser('clerk_1', 'estimate_1', {
        materialIds: ['material_1'],
      }),
    ).rejects.toThrow(
      'One or more selected materials have already been added to this estimate',
    );
  });

  it('rejects cancelled materials', async () => {
    const tx = {
      orm: {
        public: {
          Estimate: makeQuery({
            id: 'estimate_1',

            customerId: 'customer_1',

            jobId: 'job_1',

            status: EstimateStatus.DRAFT,

            currency: 'CAD',

            discountCents: 0,

            taxRate: '5.0000',
          }),

          EstimateLineItem: makeQuery([]),

          JobMaterial: makeQuery([
            {
              id: 'material_1',

              name: 'Cancelled Material',

              description: null,

              quantity: '1.000',

              status: 'CANCELLED',

              billableUnitPriceCents: 500,
            },
          ]),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().addMaterialsForUser('clerk_1', 'estimate_1', {
        materialIds: ['material_1'],
      }),
    ).rejects.toThrow(
      'Cancelled Material is cancelled and cannot be added to an estimate',
    );
  });

  it('skips an automatic expiration when the CAS loses the race', async () => {
    mockedDb.orm.public.Estimate = makeQuery([
      {
        id: 'estimate_1',

        organizationId: 'org_1',

        customerId: 'customer_1',

        number: 'EST-00001',

        status: EstimateStatus.SENT,

        totalCents: 1000,

        validUntil: new Date('2026-09-01T00:00:00.000Z'),
      },
    ]);

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

    const result = await service().processExpiredEstimates();

    expect(result).toMatchObject({
      scanned: 1,

      expired: 0,

      skipped: 1,

      failures: [],
    });
  });
});
