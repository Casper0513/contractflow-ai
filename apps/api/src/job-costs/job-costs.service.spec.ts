jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-01-01T00:00:00.000Z'),
  ),

  toPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-01-02T12:00:00.000Z'),
  ),
}));

import { db } from '@contractflow/db-prisma8';
import { JobCostCategory } from '@contractflow/db';

import { JobCostsService } from './job-costs.service';

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

describe('JobCostsService Prisma 8', () => {
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

  const organizationMemberships = {
    resolveForUser: jest.fn().mockResolvedValue(membership),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    organizationMemberships.resolveForUser.mockResolvedValue(membership);
  });

  it('aggregates job financial summary correctly', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      currency: 'CAD',
      budgetCents: 100000,
    });

    const costsQuery = makeQuery([
      {
        category: 'MATERIAL',
        amountCents: 20000,
      },
      {
        category: 'LABOR',
        amountCents: 5000,
      },
    ]);

    const timeEntriesQuery = makeQuery([
      {
        endedAt: new Date(),
        laborCostCents: 10000,
      },
      {
        endedAt: null,
        laborCostCents: 9000,
      },
    ]);

    const invoicesQuery = makeQuery([
      {
        id: 'invoice_1',
        status: 'SENT',
        totalCents: 80000,
      },
      {
        id: 'invoice_2',
        status: 'VOIDED',
        totalCents: 50000,
      },
    ]);

    const paymentsQuery = makeQuery([
      {
        invoiceId: 'invoice_1',
        amountCents: 30000,
      },
      {
        invoiceId: 'invoice_2',
        amountCents: 20000,
      },
    ]);

    mockedDb.orm.public = {
      Job: jobQuery,
      JobCost: costsQuery,
      JobTimeEntry: timeEntriesQuery,
      Invoice: invoicesQuery,
      Payment: paymentsQuery,
    };

    const service = new JobCostsService(organizationMemberships);

    const result = await service.getSummaryForJobForUser('clerk_1', 'job_1');

    expect(result.categoryTotals).toEqual({
      MATERIAL: 20000,
      LABOR: 15000,
      SUBCONTRACTOR: 0,
      EQUIPMENT: 0,
      PERMIT: 0,
      TRAVEL: 0,
      OTHER: 0,
    });

    expect(result.actualCostCents).toBe(35000);

    expect(result.invoicedRevenueCents).toBe(80000);

    expect(result.collectedRevenueCents).toBe(30000);

    expect(result.grossProfitCents).toBe(45000);

    expect(result.budgetVarianceCents).toBe(65000);

    expect(result.grossMarginPercent).toBe(56.25);
  });

  it('creates a cost and JOB_COST_CREATED activity in one transaction', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const cost = {
      id: 'cost_1',

      organizationId: 'org_1',

      jobId: 'job_1',

      createdByUserId: 'user_1',

      category: 'MATERIAL',

      description: 'Lumber',

      amountCents: 12500,

      incurredAt: new Date(),

      vendor: 'Supplier',

      reference: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    const costCreate = jest.fn().mockResolvedValue(cost);

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobCost: {
            create: costCreate,
          },

          User: userQuery,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobCostsService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      category: JobCostCategory.MATERIAL,

      description: '  Lumber  ',

      amountCents: 12500,

      vendor: '  Supplier  ',
    });

    expect(costCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        jobId: 'job_1',

        createdByUserId: 'user_1',

        category: JobCostCategory.MATERIAL,

        description: 'Lumber',

        amountCents: 12500,

        vendor: 'Supplier',
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const createdActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          customerId?: string;
          actorUserId?: string | null;
          metadata?: unknown;
        },
      ]
    >;
    const createdActivityArg = createdActivityCalls[0]?.[0];

    expect(createdActivityArg).toMatchObject({
      _type: 'JOB_COST_CREATED',
      customerId: 'customer_1',
      actorUserId: 'user_1',
    });

    expect(createdActivityArg?.metadata).toMatchObject({
      costId: 'cost_1',
      amountCents: 12500,
    });

    expect(result.createdBy).toEqual({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });
  });

  it('records JOB_COST_UPDATED when values change', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'cost_1',

      organizationId: 'org_1',

      jobId: 'job_1',

      createdByUserId: 'user_1',

      category: 'MATERIAL',

      description: 'Lumber',

      amountCents: 10000,

      incurredAt: new Date('2026-01-01T00:00:00.000Z'),

      vendor: 'Supplier',

      reference: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    const updated = {
      ...existing,
      amountCents: 15000,
    };

    let whereCall = 0;

    const costModel = {
      where: jest.fn(),
    };

    costModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: jest.fn().mockResolvedValue(undefined),
        };
      }

      return makeQuery(updated);
    });

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobCost: costModel,

          User: userQuery,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobCostsService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'cost_1', {
      amountCents: 15000,
    });

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const updatedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const updatedActivityArg = updatedActivityCalls[0]?.[0];

    expect(updatedActivityArg).toMatchObject({
      _type: 'JOB_COST_UPDATED',
    });

    expect(updatedActivityArg?.metadata).toMatchObject({
      changes: {
        amountCents: {
          oldValue: '10000',
          newValue: '15000',
        },
      },
    });
  });

  it('does not record JOB_COST_UPDATED when nothing changes', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'cost_1',

      organizationId: 'org_1',

      jobId: 'job_1',

      createdByUserId: 'user_1',

      category: 'MATERIAL',

      description: 'Lumber',

      amountCents: 10000,

      incurredAt: new Date('2026-01-01T00:00:00.000Z'),

      vendor: null,

      reference: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    let whereCall = 0;

    const costModel = {
      where: jest.fn(),
    };

    costModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: jest.fn().mockResolvedValue(undefined),
        };
      }

      return makeQuery(existing);
    });

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobCost: costModel,

          User: userQuery,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobCostsService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'cost_1', {});

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('deletes a cost and records JOB_COST_DELETED', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'cost_1',

      organizationId: 'org_1',

      jobId: 'job_1',

      createdByUserId: 'user_1',

      category: 'MATERIAL',

      description: 'Lumber',

      amountCents: 10000,

      incurredAt: new Date(),

      vendor: null,

      reference: null,

      notes: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };

    let whereCall = 0;

    const deleteOperation = jest.fn().mockResolvedValue(undefined);

    const costModel = {
      where: jest.fn(),
    };

    costModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      return {
        delete: deleteOperation,
      };
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobCost: costModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobCostsService(organizationMemberships);

    await expect(
      service.deleteForUser('clerk_1', 'job_1', 'cost_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(deleteOperation).toHaveBeenCalledTimes(1);

    const deletedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const deletedActivityArg = deletedActivityCalls[0]?.[0];

    expect(deletedActivityArg).toMatchObject({
      _type: 'JOB_COST_DELETED',
    });

    expect(deletedActivityArg?.metadata).toMatchObject({
      costId: 'cost_1',
      category: 'MATERIAL',
      amountCents: 10000,
    });
  });
});
