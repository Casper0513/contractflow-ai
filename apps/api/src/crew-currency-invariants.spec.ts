jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),
    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-02T08:00:00.000Z'),
  ),

  toPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-02T08:00:00.000Z'),
  ),
}));

import { db } from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from './auth/organization-membership.service';
import { CrewService } from './crew/crew.service';
import { JobTimeEntriesService } from './job-time-entries/job-time-entries.service';

function createMembershipService(): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn().mockResolvedValue({
      id: 'membership_1',

      userId: 'user_db_1',

      organizationId: 'org_1',

      role: 'OWNER',
    }),
  };
}

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

function mockPrisma8Transaction(client: unknown) {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;
  };

  mockedDb.transaction.mockImplementation(
    async (callback: (tx: unknown) => Promise<unknown>) => callback(client),
  );
}

function createExistingTimeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry_1',

    organizationId: 'org_1',

    jobId: 'job_1',

    crewMemberId: 'crew_1',

    createdByUserId: 'user_db_1',

    startedAt: new Date('2026-09-02T08:00:00.000Z'),

    endedAt: new Date('2026-09-02T10:00:00.000Z'),

    hourlyCostCents: 5000,

    laborCostCents: 10000,

    currency: 'JPY',

    notes: 'Original note',

    createdAt: new Date('2026-09-02T08:00:00.000Z'),

    updatedAt: new Date('2026-09-02T10:00:00.000Z'),

    ...overrides,
  };
}

function createHydratedCrewMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'crew_1',

    firstName: 'Avery',

    lastName: 'Worker',

    email: null,

    phone: null,

    active: true,

    hourlyCostCents: 5000,

    currency: 'JPY',

    ...overrides,
  };
}

function createHydratedUser() {
  return {
    id: 'user_db_1',

    firstName: 'Owner',

    lastName: 'User',

    email: 'owner@example.com',
  };
}

describe('Crew and job time-entry currency invariants', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('copies the organization currency onto a new crew member', async () => {
    const membershipService = createMembershipService();

    const service = new CrewService(membershipService);

    const organizationQuery = makeQuery({
      currency: 'JPY',
    });

    const createdCrewMember = {
      id: 'crew_1',

      organizationId: 'org_1',

      firstName: 'Avery',

      lastName: null,

      email: null,

      phone: null,

      hourlyCostCents: 5000,

      currency: 'JPY',

      dailyCapacityMinutes: null,

      active: true,

      createdAt: new Date('2026-09-02T08:00:00.000Z'),

      updatedAt: new Date('2026-09-02T08:00:00.000Z'),
    };

    const crewMemberCreate = jest.fn().mockResolvedValue(createdCrewMember);

    const timeEntriesQuery = makeQuery([]);

    const scheduleAssignmentsQuery = makeQuery([]);

    const mockedDb = db as unknown as {
      orm: {
        public: Record<string, unknown>;
      };
    };

    mockedDb.orm.public = {
      Organization: organizationQuery,

      CrewMember: {
        create: crewMemberCreate,
      },

      JobTimeEntry: timeEntriesQuery,

      JobScheduleCrewMember: scheduleAssignmentsQuery,
    };

    const result = await service.createForUser(
      'clerk_user_1',
      {
        firstName: 'Avery',

        hourlyCostCents: 5000,
      },
      'org_1',
    );

    expect(organizationQuery.where).toHaveBeenCalledWith({
      id: 'org_1',
    });

    expect(organizationQuery.select).toHaveBeenCalledWith('currency');

    expect(crewMemberCreate).toHaveBeenCalledTimes(1);

    expect(crewMemberCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        firstName: 'Avery',

        hourlyCostCents: 5000,

        currency: 'JPY',

        active: true,
      }),
    );

    expect(result.currency).toBe('JPY');

    expect(result._count).toEqual({
      timeEntries: 0,

      scheduleAssignments: 0,
    });
  });

  it('copies the job currency onto a new time-entry labor snapshot', async () => {
    const membershipService = createMembershipService();

    const service = new JobTimeEntriesService(membershipService);

    const jobQuery = makeQuery({
      id: 'job_1',

      currency: 'JPY',
    });

    const crewQuery = makeQuery(createHydratedCrewMember());

    const created = createExistingTimeEntry({
      notes: 'Install work',
    });

    const timeEntryCreate = jest.fn().mockResolvedValue(created);

    const userQuery = makeQuery(createHydratedUser());

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          CrewMember: crewQuery,

          JobTimeEntry: {
            create: timeEntryCreate,
          },

          User: userQuery,
        },
      },
    };

    mockPrisma8Transaction(tx);

    await service.createForUser(
      'clerk_user_1',
      'job_1',
      {
        crewMemberId: 'crew_1',

        startedAt: '2026-09-02T08:00:00.000Z',

        endedAt: '2026-09-02T10:00:00.000Z',

        notes: 'Install work',
      },
      'org_1',
    );

    expect(timeEntryCreate).toHaveBeenCalledTimes(1);

    const timeEntryCreateCalls = timeEntryCreate.mock.calls as Array<
      [
        {
          organizationId?: string;
          jobId?: string;
          crewMemberId?: string;
          hourlyCostCents?: number;
          laborCostCents?: number;
          currency?: string;
          notes?: string;
        },
      ]
    >;
    const timeEntryCreateArg = timeEntryCreateCalls[0]?.[0];

    expect(timeEntryCreateArg).toMatchObject({
      organizationId: 'org_1',

      jobId: 'job_1',

      crewMemberId: 'crew_1',

      hourlyCostCents: 5000,

      laborCostCents: 10000,

      currency: 'JPY',

      notes: 'Install work',
    });
  });

  it('rejects time-entry creation when crew and job currencies differ', async () => {
    const membershipService = createMembershipService();

    const service = new JobTimeEntriesService(membershipService);

    const timeEntryCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery({
            id: 'job_1',

            currency: 'JPY',
          }),

          CrewMember: makeQuery({
            id: 'crew_1',

            hourlyCostCents: 5000,

            currency: 'USD',

            active: true,
          }),

          JobTimeEntry: {
            create: timeEntryCreate,
          },
        },
      },
    };

    mockPrisma8Transaction(tx);

    await expect(
      service.createForUser(
        'clerk_user_1',
        'job_1',
        {
          crewMemberId: 'crew_1',

          startedAt: '2026-09-02T08:00:00.000Z',

          endedAt: '2026-09-02T10:00:00.000Z',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Crew member hourly cost currency must match the job currency',
    );

    expect(timeEntryCreate).not.toHaveBeenCalled();
  });

  it('rejects reassignment to a crew member whose currency differs from the job', async () => {
    const membershipService = createMembershipService();

    const service = new JobTimeEntriesService(membershipService);

    const existing = createExistingTimeEntry();

    const jobQuery = makeQuery({
      id: 'job_1',

      currency: 'JPY',
    });

    const entryQuery = makeQuery(existing);

    const crewQuery = makeQuery({
      id: 'crew_2',

      hourlyCostCents: 6500,

      currency: 'USD',

      active: true,
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobTimeEntry: entryQuery,

          CrewMember: crewQuery,
        },
      },
    };

    mockPrisma8Transaction(tx);

    await expect(
      service.updateForUser(
        'clerk_user_1',
        'job_1',
        'entry_1',
        {
          crewMemberId: 'crew_2',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Crew member hourly cost currency must match the job currency',
    );

    expect(entryQuery.update).not.toHaveBeenCalled();
  });

  it('preserves the existing time-entry currency when editing dates or notes', async () => {
    const membershipService = createMembershipService();

    const service = new JobTimeEntriesService(membershipService);

    const existing = createExistingTimeEntry();

    const updated = createExistingTimeEntry({
      startedAt: new Date('2026-09-02T09:00:00.000Z'),

      endedAt: new Date('2026-09-02T11:00:00.000Z'),

      notes: 'Updated note',
    });

    const jobQuery = makeQuery({
      id: 'job_1',

      currency: 'JPY',
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const timeEntryModel = {
      where: jest.fn(),
    };

    timeEntryModel.where.mockImplementation(() => {
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

    const crewMemberModel = makeQuery(createHydratedCrewMember());

    const userModel = makeQuery(createHydratedUser());

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          JobTimeEntry: timeEntryModel,

          CrewMember: crewMemberModel,

          User: userModel,
        },
      },
    };

    mockPrisma8Transaction(tx);

    await service.updateForUser(
      'clerk_user_1',
      'job_1',
      'entry_1',
      {
        startedAt: '2026-09-02T09:00:00.000Z',

        endedAt: '2026-09-02T11:00:00.000Z',

        notes: 'Updated note',
      },
      'org_1',
    );

    expect(updateOperation).toHaveBeenCalledTimes(1);

    const updateCalls = updateOperation.mock.calls as Array<
      [
        {
          crewMemberId?: string;
          startedAt?: Date;
          endedAt?: Date;
          hourlyCostCents?: number;
          laborCostCents?: number;
          notes?: string;
        },
      ]
    >;
    const updateArgument = updateCalls[0]?.[0];

    expect(updateArgument).toMatchObject({
      crewMemberId: 'crew_1',

      startedAt: new Date('2026-09-02T09:00:00.000Z'),

      endedAt: new Date('2026-09-02T11:00:00.000Z'),

      hourlyCostCents: 5000,

      laborCostCents: 10000,

      notes: 'Updated note',
    });

    expect(updateArgument).not.toHaveProperty('currency');

    expect(crewMemberModel.where).not.toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        active: true,
      }),
    );
  });

  it('rejects an existing time entry whose currency no longer matches its job', async () => {
    const membershipService = createMembershipService();

    const service = new JobTimeEntriesService(membershipService);

    const existing = createExistingTimeEntry({
      currency: 'USD',
    });

    const entryQuery = makeQuery(existing);

    const tx = {
      orm: {
        public: {
          Job: makeQuery({
            id: 'job_1',

            currency: 'JPY',
          }),

          JobTimeEntry: entryQuery,

          CrewMember: makeQuery(null),
        },
      },
    };

    mockPrisma8Transaction(tx);

    await expect(
      service.updateForUser(
        'clerk_user_1',
        'job_1',
        'entry_1',
        {
          notes: 'Attempted edit',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Job time entry currency does not match the job currency',
    );

    expect(entryQuery.update).not.toHaveBeenCalled();
  });
});
