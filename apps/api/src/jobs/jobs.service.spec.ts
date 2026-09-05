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
  };
});

import { BadRequestException } from '@nestjs/common';
import { JobPriority, JobStatus } from '@contractflow/db';
import { db } from '@contractflow/db-prisma8';

import { JobsService } from './jobs.service';

function makeQuery<T>(result: T) {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
    all: jest.fn(),
    update: jest.fn(),
  };

  query.where.mockReturnValue(query);

  query.select.mockReturnValue(query);

  query.orderBy.mockReturnValue(query);

  query.first.mockResolvedValue(result);

  query.all.mockResolvedValue(result);

  query.update.mockResolvedValue(result);

  return query;
}

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_1',

    organizationId: 'org_1',

    customerId: 'customer_1',

    createdByUserId: null,

    name: 'Test Job',

    description: null,

    status: JobStatus.APPROVED,

    priority: JobPriority.NORMAL,

    addressLine1: null,

    addressLine2: null,

    city: null,

    province: null,

    postalCode: null,

    country: 'CA',

    startDate: null,

    endDate: null,

    currency: 'CAD',

    budgetCents: 10000,

    archivedAt: null,

    createdAt: new Date('2026-09-01T12:00:00.000Z'),

    updatedAt: new Date('2026-09-01T12:00:00.000Z'),

    ...overrides,
  };
}

describe('JobsService Prisma 8', () => {
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
    return new JobsService(organizationMemberships);
  }

  function installHydrationModels() {
    mockedDb.orm.public.Customer = makeQuery({
      id: 'customer_1',

      firstName: 'Test',

      lastName: 'Customer',

      companyName: null,
    });

    mockedDb.orm.public.User = makeQuery({
      id: 'user_1',

      firstName: 'Test',

      lastName: 'User',

      email: 'user@example.com',
    });
  }

  it('filters job activity by metadata.jobId and hydrates actor', async () => {
    mockedDb.orm.public.Job = makeQuery({
      id: 'job_1',

      customerId: 'customer_1',
    });

    mockedDb.orm.public.CustomerActivity = makeQuery([
      {
        id: 'activity_1',

        _type: 'JOB_UPDATED',

        title: 'Job updated',

        description: 'Changed',

        metadata: {
          jobId: 'job_1',
        },

        createdAt: new Date('2026-09-04T12:00:00.000Z'),

        actorUserId: 'user_1',
      },

      {
        id: 'activity_2',

        _type: 'JOB_UPDATED',

        title: 'Other job',

        description: null,

        metadata: {
          jobId: 'job_other',
        },

        createdAt: new Date('2026-09-03T12:00:00.000Z'),

        actorUserId: null,
      },
    ]);

    mockedDb.orm.public.User = makeQuery({
      id: 'user_1',

      firstName: 'Test',

      lastName: 'User',

      email: 'user@example.com',
    });

    const result = await service().listActivityForUser('clerk_1', 'job_1');

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id: 'activity_1',

      type: 'JOB_UPDATED',

      actor: {
        id: 'user_1',
      },
    });
  });

  it('filters dispatch backlog and preserves priority ordering', async () => {
    mockedDb.orm.public.Job = makeQuery([
      jobRow({
        id: 'job_normal',

        priority: JobPriority.NORMAL,

        createdAt: new Date('2026-09-01T12:00:00.000Z'),
      }),

      jobRow({
        id: 'job_urgent_scheduled',

        priority: JobPriority.URGENT,

        createdAt: new Date('2026-08-30T12:00:00.000Z'),
      }),

      jobRow({
        id: 'job_high',

        priority: JobPriority.HIGH,

        createdAt: new Date('2026-09-02T12:00:00.000Z'),
      }),

      jobRow({
        id: 'job_cancelled',

        status: JobStatus.CANCELLED,

        priority: JobPriority.URGENT,
      }),
    ]);

    mockedDb.orm.public.JobSchedule = {
      where: jest.fn(({ jobId }: { jobId: string }) =>
        makeQuery(
          jobId === 'job_urgent_scheduled'
            ? [
                {
                  id: 'schedule_1',

                  status: 'SCHEDULED',
                },
              ]
            : [],
        ),
      ),
    };

    installHydrationModels();

    const result = await service().listDispatchBacklogForUser('clerk_1');

    expect(result.map((job) => job.id)).toEqual(['job_high', 'job_normal']);
  });

  it('creates a Job from an approved Estimate, wins CAS, and writes JOB_CREATED', async () => {
    const created = jobRow({
      createdByUserId: 'user_1',
    });

    const createJob = jest.fn().mockResolvedValue(created);

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    const estimateQuery = makeQuery({
      id: 'estimate_1',

      organizationId: 'org_1',

      customerId: 'customer_1',

      jobId: null,

      number: 'EST-1001',

      status: 'APPROVED',

      title: 'Approved Work',

      notes: null,

      currency: 'CAD',

      totalCents: 10000,
    });

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 1,
      }),

      orm: {
        public: {
          Estimate: estimateQuery,

          Job: {
            create: createJob,
          },

          Customer: makeQuery({
            id: 'customer_1',

            firstName: 'Test',

            lastName: 'Customer',

            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',

            firstName: 'Test',

            lastName: 'User',

            email: 'user@example.com',
          }),

          CustomerActivity: {
            create: createActivity,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    const result = await service().createFromEstimateForUser(
      'clerk_1',
      'estimate_1',
    );

    expect(result.id).toBe('job_1');

    expect(tx.execute).toHaveBeenCalledTimes(1);

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
      _type: 'JOB_CREATED',
      customerId: 'customer_1',
    });

    expect(createActivityArg?.metadata).toMatchObject({
      estimateId: 'estimate_1',
      source: 'approved_estimate',
    });
  });

  it('throws when another request wins the Estimate -> Job CAS', async () => {
    const createActivity = jest.fn();

    const tx = {
      execute: jest.fn().mockResolvedValue({
        affectedRows: 0,
      }),

      orm: {
        public: {
          Estimate: makeQuery({
            id: 'estimate_1',

            organizationId: 'org_1',

            customerId: 'customer_1',

            jobId: null,

            number: 'EST-1001',

            status: 'APPROVED',

            title: null,

            notes: null,

            currency: 'CAD',

            totalCents: 10000,
          }),

          Job: {
            create: jest.fn().mockResolvedValue(
              jobRow({
                createdByUserId: 'user_1',
              }),
            ),
          },

          CustomerActivity: {
            create: createActivity,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    await expect(
      service().createFromEstimateForUser('clerk_1', 'estimate_1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(createActivity).not.toHaveBeenCalled();
  });

  it('returns the existing Job when the Estimate is already linked', async () => {
    const existing = jobRow({
      createdByUserId: 'user_1',
    });

    const jobQuery = makeQuery(existing);

    const createJob = jest.fn();

    Object.assign(jobQuery, {
      create: createJob,
    });

    const tx = {
      orm: {
        public: {
          Estimate: makeQuery({
            id: 'estimate_1',

            organizationId: 'org_1',

            customerId: 'customer_1',

            jobId: 'job_1',

            number: 'EST-1001',

            status: 'APPROVED',

            title: null,

            notes: null,

            currency: 'CAD',

            totalCents: 10000,
          }),

          Job: jobQuery,

          Customer: makeQuery({
            id: 'customer_1',

            firstName: 'Test',

            lastName: 'Customer',

            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',

            firstName: 'Test',

            lastName: 'User',

            email: 'user@example.com',
          }),
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    const result = await service().createFromEstimateForUser(
      'clerk_1',
      'estimate_1',
    );

    expect(result.id).toBe('job_1');

    expect(createJob).not.toHaveBeenCalled();
  });

  it('reports task, schedule, and checklist completion blockers', async () => {
    const tx = {
      orm: {
        public: {
          JobTask: makeQuery([
            {
              id: 'task_1',

              status: 'TODO',
            },
          ]),

          JobSchedule: makeQuery([
            {
              id: 'schedule_1',

              status: 'SCHEDULED',
            },
          ]),

          JobChecklist: makeQuery([
            {
              id: 'checklist_1',
            },
          ]),

          JobChecklistItem: makeQuery([
            {
              id: 'item_1',

              completedAt: null,
            },
          ]),
        },
      },
    };

    try {
      await (
        service() as unknown as {
          requireJobReadyForCompletion: (
            organizationId: string,

            jobId: string,

            tx: unknown,
          ) => Promise<void>;
        }
      ).requireJobReadyForCompletion('org_1', 'job_1', tx);

      throw new Error('Expected completion guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);

      const response = (error as BadRequestException).getResponse();

      expect(response).toMatchObject({
        code: 'JOB_NOT_READY_FOR_COMPLETION',

        activeTaskCount: 1,

        activeScheduleCount: 1,

        incompleteChecklistItemCount: 1,
      });
    }
  });

  it('writes JOB_UPDATED activity for old and new customer on reassignment', async () => {
    const existing = {
      id: 'job_1',

      customerId: 'customer_1',

      name: 'Test Job',

      description: null,

      status: JobStatus.APPROVED,

      priority: JobPriority.NORMAL,

      addressLine1: null,

      addressLine2: null,

      city: null,

      province: null,

      postalCode: null,

      country: 'CA',

      startDate: null,

      endDate: null,

      currency: 'CAD',

      budgetCents: 10000,
    };

    const updated = jobRow({
      customerId: 'customer_2',

      createdByUserId: 'user_1',
    });

    const jobQuery = makeQuery(existing);

    jobQuery.update.mockResolvedValue(updated);

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,

          Customer: makeQuery({
            id: 'customer_2',

            firstName: 'New',

            lastName: 'Customer',

            companyName: null,
          }),

          User: makeQuery({
            id: 'user_1',

            firstName: 'Test',

            lastName: 'User',

            email: 'user@example.com',
          }),

          CustomerActivity: {
            create: createActivity,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) => callback(tx),
    );

    const result = await service().updateForUser('clerk_1', 'job_1', {
      customerId: 'customer_2',
    });

    expect(result.customerId).toBe('customer_2');

    expect(createActivity).toHaveBeenCalledTimes(2);

    expect(createActivity).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        customerId: 'customer_1',

        _type: 'JOB_UPDATED',

        title: 'Job updated',
      }),
    );

    expect(createActivity).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        customerId: 'customer_2',

        _type: 'JOB_UPDATED',

        title: 'Job assigned',
      }),
    );
  });
});
