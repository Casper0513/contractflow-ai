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

  toPrisma8Timestamp: jest.fn(() => new Date('2026-01-02T12:00:00.000Z')),

  toPrisma8Numeric: jest.fn((value) => ({
    toString: () => Number(value).toFixed(3),
  })),
}));

import { db } from '@contractflow/db-prisma8';

import { JobMaterialsService } from './job-materials.service';

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

function material(overrides: Record<string, unknown> = {}) {
  return {
    id: 'material_1',
    organizationId: 'org_1',
    jobId: 'job_1',
    createdByUserId: null,

    name: 'Lumber',
    description: null,

    quantity: {
      toString: () => '2.500',
    },

    unit: 'EACH',

    supplier: null,
    sku: null,
    reference: null,
    notes: null,

    estimatedUnitCostCents: 1000,
    actualUnitCostCents: null,
    billableUnitPriceCents: 1500,

    status: 'REQUIRED',

    orderedAt: null,
    receivedAt: null,

    createdAt: new Date(),
    updatedAt: new Date(),

    ...overrides,
  };
}

describe('JobMaterialsService Prisma 8', () => {
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

  it('creates material with Prisma 8 numeric quantity and activity', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const created = material({
      createdByUserId: 'user_1',
    });

    const materialCreate = jest.fn().mockResolvedValue(created);

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

          JobMaterial: {
            create: materialCreate,
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

    const service = new JobMaterialsService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      name: '  Lumber  ',
      quantity: 2.5,
      unit: 'EACH',
      estimatedUnitCostCents: 1000,
      billableUnitPriceCents: 1500,
    });

    expect(materialCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lumber',
        status: 'REQUIRED',
        orderedAt: null,
        receivedAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const createdActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createdActivityArg = createdActivityCalls[0]?.[0];

    expect(createdActivityArg).toMatchObject({
      _type: 'JOB_MATERIAL_CREATED',
    });

    expect(createdActivityArg?.metadata).toMatchObject({
      materialId: 'material_1',
      quantity: '2.500',
    });

    expect(result.quantity.toString()).toBe('2.500');
  });

  it('does not create update activity for a no-op update', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material();

    let whereCall = 0;

    const materialModel = {
      where: jest.fn(),
    };

    materialModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
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
          Job: jobQuery,

          JobMaterial: materialModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'material_1', {});

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('orders only REQUIRED material and records lifecycle activity', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material({
      status: 'REQUIRED',
    });

    const ordered = material({
      status: 'ORDERED',
      orderedAt: new Date('2026-01-02T12:00:00.000Z'),
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const materialModel = {
      where: jest.fn(),
    };

    materialModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(ordered);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobMaterial: materialModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    const result = await service.orderForUser('clerk_1', 'job_1', 'material_1');

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ORDERED',
        receivedAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const orderedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const orderedActivityArg = orderedActivityCalls[0]?.[0];

    expect(orderedActivityArg).toMatchObject({
      _type: 'JOB_MATERIAL_UPDATED',
    });

    expect(orderedActivityArg?.metadata).toMatchObject({
      previousStatus: 'REQUIRED',
      status: 'ORDERED',
    });

    expect(result.status).toBe('ORDERED');
  });

  it('receives REQUIRED material and sets orderedAt automatically', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material({
      status: 'REQUIRED',
      orderedAt: null,
    });

    const received = material({
      status: 'RECEIVED',

      orderedAt: new Date('2026-01-02T12:00:00.000Z'),

      receivedAt: new Date('2026-01-02T12:00:00.000Z'),
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const materialModel = {
      where: jest.fn(),
    };

    materialModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(received);
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobMaterial: materialModel,

          CustomerActivity: {
            create: jest.fn(),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    const result = await service.receiveForUser(
      'clerk_1',
      'job_1',
      'material_1',
    );

    expect(updateOperation).toHaveBeenCalledTimes(1);

    const receiveUpdateCalls = updateOperation.mock.calls as Array<
      [
        {
          status?: string;
          orderedAt?: unknown;
          receivedAt?: unknown;
        },
      ]
    >;
    const receiveUpdateArg = receiveUpdateCalls[0]?.[0];

    expect(receiveUpdateArg).toMatchObject({
      status: 'RECEIVED',
    });
    expect(receiveUpdateArg?.orderedAt).toBeInstanceOf(Date);
    expect(receiveUpdateArg?.receivedAt).toBeInstanceOf(Date);

    expect(result.status).toBe('RECEIVED');
  });

  it('rejects ordering a non-REQUIRED material', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material({
      status: 'ORDERED',
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobMaterial: makeQuery(existing),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    await expect(
      service.orderForUser('clerk_1', 'job_1', 'material_1'),
    ).rejects.toThrow('Only required materials can be marked as ordered');
  });

  it('restores CANCELLED material to REQUIRED and clears lifecycle dates', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material({
      status: 'CANCELLED',

      orderedAt: new Date(),

      receivedAt: new Date(),
    });

    const restored = material({
      status: 'REQUIRED',

      orderedAt: null,

      receivedAt: null,
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const materialModel = {
      where: jest.fn(),
    };

    materialModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(restored);
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobMaterial: materialModel,

          CustomerActivity: {
            create: jest.fn(),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    const result = await service.restoreForUser(
      'clerk_1',
      'job_1',
      'material_1',
    );

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'REQUIRED',

        orderedAt: null,

        receivedAt: null,
      }),
    );

    expect(result.status).toBe('REQUIRED');
  });

  it('deletes material and records JOB_MATERIAL_DELETED', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = material();

    let whereCall = 0;

    const deleteOperation = jest.fn();

    const materialModel = {
      where: jest.fn(),
    };

    materialModel.where.mockImplementation(() => {
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

          JobMaterial: materialModel,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobMaterialsService(organizationMemberships);

    await expect(
      service.deleteForUser('clerk_1', 'job_1', 'material_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(deleteOperation).toHaveBeenCalledTimes(1);

    expect(activityCreate).toHaveBeenCalledTimes(1);

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
      _type: 'JOB_MATERIAL_DELETED',
    });

    expect(deletedActivityArg?.metadata).toMatchObject({
      materialId: 'material_1',
      quantity: '2.500',
    });
  });
});
