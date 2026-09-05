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

import { JobTasksService } from './job-tasks.service';

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

describe('JobTasksService Prisma 8', () => {
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

  it('creates a completed task with completedAt and TASK_CREATED', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const task = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: 'user_1',
      title: 'Finish cleanup',
      description: null,
      status: 'COMPLETED',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: new Date('2026-01-02T12:00:00.000Z'),
      createdAt: new Date('2026-01-02T12:00:00.000Z'),
      updatedAt: new Date('2026-01-02T12:00:00.000Z'),
    };

    const taskCreate = jest.fn().mockResolvedValue(task);

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

          JobTask: {
            create: taskCreate,
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

    const service = new JobTasksService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      title: '  Finish cleanup  ',
      status: 'COMPLETED',
      priority: 'NORMAL',
    });

    expect(taskCreate).toHaveBeenCalledTimes(1);

    const taskCreateCalls = taskCreate.mock.calls as Array<
      [
        {
          title?: string;
          status?: string;
          completedAt?: unknown;
        },
      ]
    >;
    const taskCreateArg = taskCreateCalls[0]?.[0];

    expect(taskCreateArg).toMatchObject({
      title: 'Finish cleanup',
      status: 'COMPLETED',
    });
    expect(taskCreateArg?.completedAt).toBeInstanceOf(Date);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'TASK_CREATED',
      }),
    );

    expect(result.completedAt).toBeInstanceOf(Date);
  });

  it('sets completedAt when update enters COMPLETED', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: null,
      title: 'Task',
      description: null,
      status: 'TODO',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updated = {
      ...existing,
      status: 'COMPLETED',
      completedAt: new Date('2026-01-02T12:00:00.000Z'),
    };

    let whereCall = 0;

    const taskModel = {
      where: jest.fn(),
    };

    taskModel.where.mockImplementation(() => {
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

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobTask: taskModel,
          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTasksService(organizationMemberships);

    const result = await service.updateForUser('clerk_1', 'job_1', 'task_1', {
      status: 'COMPLETED',
    });

    expect(result.status).toBe('COMPLETED');

    expect(result.completedAt).toBeInstanceOf(Date);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        _type: 'TASK_UPDATED',
      }),
    );
  });

  it('clears completedAt when update leaves COMPLETED', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: null,
      title: 'Task',
      description: null,
      status: 'COMPLETED',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const reopened = {
      ...existing,
      status: 'TODO',
      completedAt: null,
    };

    let whereCall = 0;

    const updateOperation = jest.fn();

    const taskModel = {
      where: jest.fn(),
    };

    taskModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return makeQuery(existing);
      }

      if (whereCall === 2) {
        return {
          update: updateOperation,
        };
      }

      return makeQuery(reopened);
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobTask: taskModel,
          CustomerActivity: {
            create: jest.fn(),
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTasksService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'task_1', {
      status: 'TODO',
    });

    expect(updateOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        completedAt: null,
      }),
    );
  });

  it('does not record TASK_UPDATED when nothing changes', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: null,
      title: 'Task',
      description: null,
      status: 'TODO',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let whereCall = 0;

    const taskModel = {
      where: jest.fn(),
    };

    taskModel.where.mockImplementation(() => {
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
          JobTask: taskModel,
          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTasksService(organizationMemberships);

    await service.updateForUser('clerk_1', 'job_1', 'task_1', {});

    expect(activityCreate).not.toHaveBeenCalled();
  });

  it('complete is idempotent when task is already completed', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: null,
      title: 'Task',
      description: null,
      status: 'COMPLETED',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskQuery = makeQuery(existing);

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobTask: taskQuery,
          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTasksService(organizationMemberships);

    const result = await service.completeForUser('clerk_1', 'job_1', 'task_1');

    expect(result.status).toBe('COMPLETED');

    expect(activityCreate).not.toHaveBeenCalled();

    expect(taskQuery.update).not.toHaveBeenCalled();
  });

  it('reopen is idempotent when task is already open', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const existing = {
      id: 'task_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: null,
      title: 'Task',
      description: null,
      status: 'TODO',
      priority: 'NORMAL',
      dueDate: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const taskQuery = makeQuery(existing);

    const activityCreate = jest.fn();

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobTask: taskQuery,
          CustomerActivity: {
            create: activityCreate,
          },
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobTasksService(organizationMemberships);

    const result = await service.reopenForUser('clerk_1', 'job_1', 'task_1');

    expect(result.status).toBe('TODO');

    expect(activityCreate).not.toHaveBeenCalled();

    expect(taskQuery.update).not.toHaveBeenCalled();
  });
});
