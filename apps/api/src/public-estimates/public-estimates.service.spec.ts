import { BadRequestException, NotFoundException } from '@nestjs/common';

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

jest.mock('@contractflow/invoice-pdf', () => ({
  createEstimatePdf: jest.fn(() => Promise.resolve(Buffer.from('pdf'))),
}));

import { db } from '@contractflow/db-prisma8';

import { PublicEstimatesService } from './public-estimates.service';

const VALID_TOKEN = 'A'.repeat(43);

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

function makePublicEstimate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate_1',
    organizationId: 'org_1',
    customerId: 'customer_1',
    jobId: null,

    number: 'EST-0001',
    status: 'VIEWED',
    title: null,
    notes: null,
    terms: null,

    validUntil: null,
    currency: 'CAD',

    subtotalCents: 1000,
    discountCents: 0,

    taxRate: '0.0500' as never,

    taxCents: 50,
    totalCents: 1050,

    sentAt: new Date(),
    viewedAt: new Date(),
    approvedAt: null,
    declinedAt: null,
    expiredAt: null,

    ...overrides,
  };
}

function makeCommonOrm(invoiceResult: Record<string, unknown>) {
  const customer = makeQuery({
    firstName: 'Jane',
    lastName: 'Doe',
    companyName: null,
    email: 'jane@example.com',
    phone: null,
  });

  const organization = makeQuery({
    name: 'ContractFlow',
    legalName: null,
    email: null,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    province: null,
    postalCode: null,
    country: 'CA',
    taxNumber: null,
    website: null,
    logoUrl: null,
    timezone: 'America/Edmonton',
    currency: 'CAD',
  });

  return {
    Customer: customer,

    Organization: organization,

    Job: makeQuery(null),

    EstimateLineItem: makeQuery([]),

    Estimate: makeQuery(invoiceResult),
  };
}

describe('PublicEstimatesService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;
    raw: {
      sql: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an invalid token before transaction', async () => {
    const service = new PublicEstimatesService();

    await expect(service.getByToken('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(mockedDb.transaction).not.toHaveBeenCalled();
  });

  it('hides missing estimates', async () => {
    const query = makeQuery(null);

    const tx = {
      orm: {
        public: {
          Estimate: query,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicEstimatesService();

    await expect(service.getByToken(VALID_TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('hides DRAFT estimates', async () => {
    const query = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'DRAFT',
    });

    const tx = {
      orm: {
        public: {
          Estimate: query,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicEstimatesService();

    await expect(service.getByToken(VALID_TOKEN)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates ESTIMATE_VIEWED only when SENT -> VIEWED affects one row', async () => {
    const initial = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'SENT',
    });

    const full = makeQuery(makePublicEstimate());

    let call = 0;

    const estimateModel = {
      where: jest.fn(),
    };

    estimateModel.where.mockImplementation(() => {
      call += 1;

      return call === 1 ? initial : full;
    });

    const activityCreate = jest.fn();

    const common = makeCommonOrm(makePublicEstimate());

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 1,
      }),

      orm: {
        public: {
          ...common,

          Estimate: estimateModel,

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
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicEstimatesService();

    await service.getByToken(VALID_TOKEN);

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const viewedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const viewedActivityArg = viewedActivityCalls[0]?.[0];

    expect(viewedActivityArg).toMatchObject({
      _type: 'ESTIMATE_VIEWED',
    });

    expect(viewedActivityArg?.metadata).toMatchObject({
      previousStatus: 'SENT',
      status: 'VIEWED',
      source: 'public_estimate_portal',
    });
  });

  it('does not create duplicate view activity when affectedRows is zero', async () => {
    const initial = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'SENT',
    });

    const full = makeQuery(makePublicEstimate());

    let call = 0;

    const estimateModel = {
      where: jest.fn(),
    };

    estimateModel.where.mockImplementation(() => {
      call += 1;

      return call === 1 ? initial : full;
    });

    const activityCreate = jest.fn();

    const common = makeCommonOrm(makePublicEstimate());

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 0,
      }),

      orm: {
        public: {
          ...common,

          Estimate: estimateModel,

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
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicEstimatesService();

    await service.getByToken(VALID_TOKEN);

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('approves from VIEWED and records ESTIMATE_APPROVED in same transaction', async () => {
    const initial = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'VIEWED',
      viewedAt: new Date(),
    });

    const full = makeQuery(
      makePublicEstimate({
        status: 'APPROVED',

        approvedAt: new Date(),
      }),
    );

    let call = 0;

    const estimateModel = {
      where: jest.fn(),
    };

    estimateModel.where.mockImplementation(() => {
      call += 1;

      return call === 1 ? initial : full;
    });

    const activityCreate = jest.fn();

    const common = makeCommonOrm(makePublicEstimate());

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 1,
      }),

      orm: {
        public: {
          ...common,

          Estimate: estimateModel,

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
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicEstimatesService();

    const result = await service.approveByToken(VALID_TOKEN);

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const approvedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const approvedActivityArg = approvedActivityCalls[0]?.[0];

    expect(approvedActivityArg).toMatchObject({
      _type: 'ESTIMATE_APPROVED',
    });

    expect(approvedActivityArg?.metadata).toMatchObject({
      previousStatus: 'VIEWED',
      status: 'APPROVED',
    });

    expect(result.status).toBe('APPROVED');
  });

  it('declines from SENT and records ESTIMATE_DECLINED', async () => {
    const initial = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'SENT',
      viewedAt: null,
    });

    const full = makeQuery(
      makePublicEstimate({
        status: 'DECLINED',

        declinedAt: new Date(),
      }),
    );

    let call = 0;

    const estimateModel = {
      where: jest.fn(),
    };

    estimateModel.where.mockImplementation(() => {
      call += 1;

      return call === 1 ? initial : full;
    });

    const activityCreate = jest.fn();

    const common = makeCommonOrm(makePublicEstimate());

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 1,
      }),

      orm: {
        public: {
          ...common,

          Estimate: estimateModel,

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
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicEstimatesService();

    await service.declineByToken(VALID_TOKEN);

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const declinedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const declinedActivityArg = declinedActivityCalls[0]?.[0];

    expect(declinedActivityArg).toMatchObject({
      _type: 'ESTIMATE_DECLINED',
    });

    expect(declinedActivityArg?.metadata).toMatchObject({
      previousStatus: 'SENT',
      status: 'DECLINED',
    });
  });

  it('rejects a concurrent decision when atomic update affects zero rows', async () => {
    const initial = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'VIEWED',
      viewedAt: new Date(),
    });

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 0,
      }),

      orm: {
        public: {
          Estimate: initial,

          CustomerActivity: {
            create: jest.fn(),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    mockedDb.raw.sql.mockReturnValue({
      affectedCount: jest.fn().mockReturnValue({
        build: jest.fn().mockReturnValue('plan'),
      }),
    });

    const service = new PublicEstimatesService();

    await expect(service.approveByToken(VALID_TOKEN)).rejects.toThrow(
      'Estimate status changed before the request could be completed',
    );
  });

  it('is idempotent when estimate already has requested decision status', async () => {
    const existing = makeQuery({
      id: 'estimate_1',
      organizationId: 'org_1',
      customerId: 'customer_1',
      number: 'EST-0001',
      status: 'APPROVED',
      viewedAt: new Date(),
    });

    const full = makeQuery(
      makePublicEstimate({
        status: 'APPROVED',

        approvedAt: new Date(),
      }),
    );

    let call = 0;

    const estimateModel = {
      where: jest.fn(),
    };

    estimateModel.where.mockImplementation(() => {
      call += 1;

      return call === 1 ? existing : full;
    });

    const common = makeCommonOrm(makePublicEstimate());

    const tx = {
      execute: jest.fn(),

      orm: {
        public: {
          ...common,

          Estimate: estimateModel,

          CustomerActivity: {
            create: jest.fn(),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new PublicEstimatesService();

    const result = await service.approveByToken(VALID_TOKEN);

    expect(tx.execute).not.toHaveBeenCalled();

    expect(result.status).toBe('APPROVED');
  });
});
