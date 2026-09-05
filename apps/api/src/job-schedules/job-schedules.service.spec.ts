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

import { JobSchedulesService } from './job-schedules.service';

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

function schedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'schedule_1',
    organizationId: 'org_1',
    jobId: 'job_1',
    createdByUserId: 'user_1',

    _type: 'WORK',
    status: 'SCHEDULED',

    title: 'Kitchen Reno',
    description: null,

    startAt: new Date('2026-01-10T08:00:00.000Z'),

    endAt: new Date('2026-01-10T10:00:00.000Z'),

    allDay: false,

    location: null,
    notes: null,

    cancelledAt: null,

    createdAt: new Date('2026-01-01T00:00:00.000Z'),

    updatedAt: new Date('2026-01-01T00:00:00.000Z'),

    ...overrides,
  };
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_1',
    customerId: 'customer_1',
    name: 'Kitchen Reno',
    status: 'APPROVED',
    archivedAt: null,

    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Edmonton',
    province: 'AB',
    postalCode: 'T5J 0N3',

    ...overrides,
  };
}

function crewMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'crew_1',
    organizationId: 'org_1',

    firstName: 'Avery',
    lastName: 'Worker',

    email: null,
    phone: null,

    hourlyCostCents: 5000,
    currency: 'CAD',

    active: true,

    createdAt: new Date(),
    updatedAt: new Date(),

    ...overrides,
  };
}

function createHydrationModels(scheduleValue = schedule()) {
  return {
    JobScheduleCrewMember: makeQuery([]),

    Job: makeQuery({
      id: 'job_1',
      name: 'Kitchen Reno',
      customerId: 'customer_1',
    }),

    Customer: makeQuery({
      id: 'customer_1',
      firstName: 'Jamie',
      lastName: 'Customer',
      companyName: null,
    }),

    User: makeQuery({
      id: 'user_1',
      firstName: 'Owner',
      lastName: 'User',
      email: 'owner@example.com',
    }),

    scheduleValue,
  };
}

describe('JobSchedulesService Prisma 8', () => {
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

  it('creates a schedule and records SCHEDULE_CREATED in the same transaction', async () => {
    const created = schedule({
      title: 'Install Day',
    });

    const hydration = createHydrationModels(created);

    const createOperation = jest.fn().mockResolvedValue(created);

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: {
            create: createOperation,
          },

          JobScheduleCrewMember: hydration.JobScheduleCrewMember,

          Customer: hydration.Customer,

          User: hydration.User,

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      title: '  Install Day  ',
      startAt: '2026-01-10T08:00:00.000Z',
      endAt: '2026-01-10T10:00:00.000Z',
    });

    expect(createOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        jobId: 'job_1',
        createdByUserId: 'user_1',

        _type: 'WORK',
        status: 'SCHEDULED',

        title: 'Install Day',
        allDay: false,
        cancelledAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const createdActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          title?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createdActivityArg = createdActivityCalls[0]?.[0];

    expect(createdActivityArg).toMatchObject({
      _type: 'SCHEDULE_CREATED',
      title: 'Schedule created',
    });

    expect(createdActivityArg?.metadata).toMatchObject({
      jobId: 'job_1',
      scheduleId: 'schedule_1',
      scheduleTitle: 'Install Day',
    });

    expect(result.title).toBe('Install Day');

    expect(result.startAt).toBeInstanceOf(Date);
  });

  it('does not create update activity for a no-op schedule update', async () => {
    const existing = schedule();

    let whereCall = 0;

    const updateOperation = jest.fn();

    const scheduleModel = {
      where: jest.fn(),
    };

    scheduleModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(existing);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: scheduleModel,

          JobScheduleCrewMember: makeQuery([]),

          Customer: makeQuery({
            id: 'customer_1',
            firstName: 'Jamie',
            lastName: 'Customer',
            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'schedule_1', {});

    expect(updateOperation).toHaveBeenCalledTimes(1);

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('assigns crew and records SCHEDULE_UPDATED activity', async () => {
    const existing = schedule();

    const assignmentCreate = jest.fn().mockResolvedValue({
      id: 'assignment_1',
    });

    let assignmentWhereCall = 0;

    const assignmentModel = {
      where: jest.fn(),
      create: assignmentCreate,
    };

    assignmentModel.where.mockImplementation(() => {
      assignmentWhereCall += 1;

      if (assignmentWhereCall === 1) {
        return makeQuery(null);
      }

      return makeQuery([]);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: makeQuery(existing),

          CrewMember: makeQuery(crewMember()),

          JobScheduleCrewMember: assignmentModel,

          Customer: makeQuery({
            id: 'customer_1',
            firstName: 'Jamie',
            lastName: 'Customer',
            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    await service.assignCrewMemberForUser(
      'clerk_1',
      'job_1',
      'schedule_1',
      'crew_1',
    );

    expect(assignmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        jobScheduleId: 'schedule_1',

        crewMemberId: 'crew_1',
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const assignedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          title?: string;
          metadata?: unknown;
        },
      ]
    >;
    const assignedActivityArg = assignedActivityCalls[0]?.[0];

    expect(assignedActivityArg).toMatchObject({
      _type: 'SCHEDULE_UPDATED',
      title: 'Crew assigned',
    });

    expect(assignedActivityArg?.metadata).toMatchObject({
      action: 'crew_assigned',
      crewMemberId: 'crew_1',
    });
  });

  it('does not duplicate an existing crew assignment or activity', async () => {
    const existing = schedule();

    const assignmentCreate = jest.fn();

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: makeQuery(existing),

          CrewMember: makeQuery(crewMember()),

          JobScheduleCrewMember: {
            ...makeQuery([]),

            where: jest
              .fn()
              .mockReturnValueOnce(
                makeQuery({
                  id: 'assignment_1',
                }),
              )
              .mockReturnValue(makeQuery([])),

            create: assignmentCreate,
          },

          Customer: makeQuery({
            id: 'customer_1',
            firstName: 'Jamie',
            lastName: 'Customer',
            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    await service.assignCrewMemberForUser(
      'clerk_1',
      'job_1',
      'schedule_1',
      'crew_1',
    );

    expect(assignmentCreate).not.toHaveBeenCalled();

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('rejects assigning crew to a cancelled schedule', async () => {
    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: makeQuery(
            schedule({
              status: 'CANCELLED',

              cancelledAt: new Date(),
            }),
          ),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    await expect(
      service.assignCrewMemberForUser(
        'clerk_1',
        'job_1',
        'schedule_1',
        'crew_1',
      ),
    ).rejects.toThrow('Crew cannot be assigned to a cancelled schedule');
  });

  it('cancels a schedule once and is idempotent when already cancelled', async () => {
    const existing = schedule();

    const cancelled = schedule({
      status: 'CANCELLED',

      cancelledAt: new Date('2026-01-02T12:00:00.000Z'),
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const scheduleModel = {
      where: jest.fn(),
    };

    scheduleModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(cancelled);
    });

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: scheduleModel,

          JobScheduleCrewMember: makeQuery([]),

          Customer: makeQuery({
            id: 'customer_1',
            firstName: 'Jamie',
            lastName: 'Customer',
            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    const result = await service.cancelForUser(
      'clerk_1',
      'job_1',
      'schedule_1',
    );

    expect(updateOperation).toHaveBeenCalledTimes(1);

    const cancelUpdateCalls = updateOperation.mock.calls as Array<
      [
        {
          status?: string;
          cancelledAt?: unknown;
        },
      ]
    >;
    const cancelUpdateArg = cancelUpdateCalls[0]?.[0];

    expect(cancelUpdateArg).toMatchObject({
      status: 'CANCELLED',
    });
    expect(cancelUpdateArg?.cancelledAt).toBeInstanceOf(Date);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'SCHEDULE_CANCELLED',
      }),
    );

    expect(result.status).toBe('CANCELLED');
  });

  it('restores a cancelled schedule and clears cancelledAt', async () => {
    const existing = schedule({
      status: 'CANCELLED',

      cancelledAt: new Date('2026-01-01T12:00:00.000Z'),
    });

    const restored = schedule({
      status: 'SCHEDULED',

      cancelledAt: null,
    });

    let whereCall = 0;

    const updateOperation = jest.fn();

    const scheduleModel = {
      where: jest.fn(),
    };

    scheduleModel.where.mockImplementation(() => {
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

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: makeQuery(job()),

          JobSchedule: scheduleModel,

          JobScheduleCrewMember: makeQuery([]),

          Customer: makeQuery({
            id: 'customer_1',
            firstName: 'Jamie',
            lastName: 'Customer',
            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',
            firstName: 'Owner',
            lastName: 'User',
            email: 'owner@example.com',
          }),

          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobSchedulesService(organizationMemberships);

    const result = await service.restoreForUser(
      'clerk_1',
      'job_1',
      'schedule_1',
    );

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SCHEDULED',

        cancelledAt: null,
      }),
    );

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'SCHEDULE_RESTORED',
      }),
    );

    expect(result.status).toBe('SCHEDULED');

    expect(result.cancelledAt).toBeNull();
  });
});
