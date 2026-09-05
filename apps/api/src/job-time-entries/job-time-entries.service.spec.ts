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

import { JobTimeEntriesService } from './job-time-entries.service';

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

function existingEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry_1',
    organizationId: 'org_1',
    jobId: 'job_1',
    crewMemberId: 'crew_1',
    createdByUserId: 'user_1',

    startedAt: new Date('2026-01-01T08:00:00.000Z'),

    endedAt: new Date('2026-01-01T10:00:00.000Z'),

    hourlyCostCents: 5000,
    laborCostCents: 10000,
    currency: 'CAD',
    notes: 'Original',

    createdAt: new Date('2026-01-01T08:00:00.000Z'),

    updatedAt: new Date('2026-01-01T10:00:00.000Z'),

    ...overrides,
  };
}

describe('JobTimeEntriesService Prisma 8', () => {
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

  it('creates a completed entry with calculated labor cost', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      currency: 'CAD',
    });

    const crewQuery = makeQuery({
      id: 'crew_1',
      firstName: 'Avery',
      lastName: 'Worker',
      email: null,
      phone: null,
      active: true,
      hourlyCostCents: 5000,
      currency: 'CAD',
    });

    const created = existingEntry();

    const createOperation = jest.fn().mockResolvedValue(created);

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Owner',
      lastName: 'User',
      email: 'owner@example.com',
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          CrewMember: crewQuery,

          JobTimeEntry: {
            create: createOperation,
          },

          User: userQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      crewMemberId: 'crew_1',
      startedAt: '2026-01-01T08:00:00.000Z',
      endedAt: '2026-01-01T10:00:00.000Z',
      notes: '  Original  ',
    });

    expect(createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        jobId: 'job_1',
        crewMemberId: 'crew_1',
        hourlyCostCents: 5000,
        laborCostCents: 10000,
        currency: 'CAD',
        notes: 'Original',
      }),
    );

    expect(result.startedAt).toBeInstanceOf(Date);

    expect(result.endedAt).toBeInstanceOf(Date);

    expect(result.crewMember).toEqual(
      expect.objectContaining({
        id: 'crew_1',
      }),
    );

    expect(result.createdBy).toEqual(
      expect.objectContaining({
        id: 'user_1',
      }),
    );
  });

  it('creates an open entry with zero labor cost', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      currency: 'CAD',
    });

    const crewQuery = makeQuery({
      id: 'crew_1',
      firstName: 'Avery',
      lastName: 'Worker',
      email: null,
      phone: null,
      active: true,
      hourlyCostCents: 5000,
      currency: 'CAD',
    });

    const created = existingEntry({
      endedAt: null,
      laborCostCents: 0,
    });

    const createOperation = jest.fn().mockResolvedValue(created);

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          CrewMember: crewQuery,

          JobTimeEntry: {
            create: createOperation,
          },

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      crewMemberId: 'crew_1',
      startedAt: '2026-01-01T08:00:00.000Z',
    });

    expect(createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        endedAt: null,
        laborCostCents: 0,
      }),
    );

    expect(result.endedAt).toBeNull();
  });

  it('recalculates labor cost when ending an open entry', async () => {
    const existing = existingEntry({
      endedAt: null,
      laborCostCents: 0,
    });

    const updated = existingEntry({
      endedAt: new Date('2026-01-01T11:00:00.000Z'),
      laborCostCents: 15000,
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const entryModel = {
      where: jest.fn(),
    };

    entryModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(updated);
    });

    const tx = {
      orm: {
        public: {
          Job: makeQuery({
            id: 'job_1',
            currency: 'CAD',
          }),

          JobTimeEntry: entryModel,

          CrewMember: makeQuery({
            id: 'crew_1',
            firstName: 'Avery',
            lastName: 'Worker',
            email: null,
            phone: null,
            active: true,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    const result = await service.updateForUser('clerk_1', 'job_1', 'entry_1', {
      endedAt: '2026-01-01T11:00:00.000Z',
    });

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        hourlyCostCents: 5000,
        laborCostCents: 15000,
      }),
    );

    expect(result.laborCostCents).toBe(15000);
  });

  it('switches crew member and snapshots the new hourly cost', async () => {
    const existing = existingEntry();

    const updated = existingEntry({
      crewMemberId: 'crew_2',
      hourlyCostCents: 7500,
      laborCostCents: 15000,
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const entryModel = {
      where: jest.fn(),
    };

    entryModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(updated);
    });

    const crewModel = makeQuery({
      id: 'crew_2',
      firstName: 'Jamie',
      lastName: 'Worker',
      email: null,
      phone: null,
      active: true,
      hourlyCostCents: 7500,
      currency: 'CAD',
    });

    const tx = {
      orm: {
        public: {
          Job: makeQuery({
            id: 'job_1',
            currency: 'CAD',
          }),

          JobTimeEntry: entryModel,

          CrewMember: crewModel,

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'entry_1', {
      crewMemberId: 'crew_2',
    });

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        crewMemberId: 'crew_2',
        hourlyCostCents: 7500,
        laborCostCents: 15000,
      }),
    );
  });

  it('rejects an end time before the start time', async () => {
    const existing = existingEntry();

    const tx = {
      orm: {
        public: {
          Job: makeQuery({
            id: 'job_1',
            currency: 'CAD',
          }),

          JobTimeEntry: makeQuery(existing),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    await expect(
      service.updateForUser('clerk_1', 'job_1', 'entry_1', {
        endedAt: '2026-01-01T07:00:00.000Z',
      }),
    ).rejects.toThrow('End time cannot be before start time');
  });

  it('deletes an existing time entry', async () => {
    const existing = existingEntry();

    let whereCall = 0;

    const deleteOperation = jest.fn();

    const entryModel = {
      where: jest.fn(),
    };

    entryModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      return {
        delete: deleteOperation,
      };
    });

    const tx = {
      orm: {
        public: {
          JobTimeEntry: entryModel,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTimeEntriesService(organizationMemberships);

    await expect(
      service.deleteForUser('clerk_1', 'job_1', 'entry_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(deleteOperation).toHaveBeenCalledTimes(1);
  });
});
