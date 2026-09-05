import { NotFoundException } from '@nestjs/common';

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
}));

import { db } from '@contractflow/db-prisma8';

import { JobNotesService } from './job-notes.service';

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

describe('JobNotesService Prisma 8', () => {
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

  it('lists notes newest first and reconstructs createdBy', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const noteQuery = makeQuery([
      {
        id: 'note_1',
        organizationId: 'org_1',
        jobId: 'job_1',
        createdByUserId: 'user_1',
        content: 'First note',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    mockedDb.orm.public = {
      Job: jobQuery,
      JobNote: noteQuery,
      User: userQuery,
    };

    const service = new JobNotesService(organizationMemberships);

    const result = await service.listForJobForUser('clerk_1', 'job_1');

    expect(noteQuery.where).toHaveBeenCalledWith({
      organizationId: 'org_1',
      jobId: 'job_1',
    });

    expect(noteQuery.orderBy).toHaveBeenCalled();

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'note_1',
        organizationId: 'org_1',
        jobId: 'job_1',
        createdByUserId: 'user_1',
        content: 'First note',

        createdBy: {
          id: 'user_1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
        },
      }),
    );

    expect(result[0]?.createdAt).toBeInstanceOf(Date);

    expect(result[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('creates note and NOTE_ADDED activity in the same transaction', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const createdNote = {
      id: 'note_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: 'user_1',
      content: 'New note',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const noteCreate = jest.fn().mockResolvedValue(createdNote);

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

          JobNote: {
            create: noteCreate,
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

    const service = new JobNotesService(organizationMemberships);

    const result = await service.createForUser('clerk_1', 'job_1', {
      content: '  New note  ',
    });

    expect(noteCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        jobId: 'job_1',
        createdByUserId: 'user_1',
        content: 'New note',
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    expect(activityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        customerId: 'customer_1',
        actorUserId: 'user_1',

        _type: 'NOTE_ADDED',

        title: 'Job note added',

        description: 'A note was added to Kitchen Reno.',

        metadata: {
          jobId: 'job_1',
          jobName: 'Kitchen Reno',
          noteId: 'note_1',
        },
      }),
    );

    expect(result.content).toBe('New note');
  });

  it('updates a note inside a Prisma 8 transaction', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const requireNoteQuery = makeQuery({
      id: 'note_1',
      content: 'Old note',
    });

    const updatedNote = {
      id: 'note_1',
      organizationId: 'org_1',
      jobId: 'job_1',
      createdByUserId: 'user_1',
      content: 'Updated note',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updatedQuery = makeQuery(updatedNote);

    let whereCall = 0;

    const noteModel = {
      where: jest.fn(),
    };

    noteModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return requireNoteQuery;
      }

      if (whereCall === 2) {
        return {
          update: jest.fn().mockResolvedValue(updatedNote),
        };
      }

      return updatedQuery;
    });

    const userQuery = makeQuery({
      id: 'user_1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobNote: noteModel,
          User: userQuery,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobNotesService(organizationMemberships);

    const result = await service.updateForUser('clerk_1', 'job_1', 'note_1', {
      content: '  Updated note  ',
    });

    expect(result.content).toBe('Updated note');
  });

  it('deletes a scoped note inside a Prisma 8 transaction', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',
      customerId: 'customer_1',
      name: 'Kitchen Reno',
    });

    const requireNoteQuery = makeQuery({
      id: 'note_1',
      content: 'Delete me',
    });

    const deleteOperation = jest.fn().mockResolvedValue(undefined);

    let whereCall = 0;

    const noteModel = {
      where: jest.fn(),
    };

    noteModel.where.mockImplementation(() => {
      whereCall += 1;

      if (whereCall === 1) {
        return requireNoteQuery;
      }

      return {
        delete: deleteOperation,
      };
    });

    const tx = {
      orm: {
        public: {
          Job: jobQuery,
          JobNote: noteModel,
        },
      },
    };

    mockedDb.transaction.mockImplementation(
      async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const service = new JobNotesService(organizationMemberships);

    await expect(
      service.deleteForUser('clerk_1', 'job_1', 'note_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(deleteOperation).toHaveBeenCalledTimes(1);
  });

  it('throws when the job is outside the organization', async () => {
    const jobQuery = makeQuery(null);

    mockedDb.orm.public = {
      Job: jobQuery,
    };

    const service = new JobNotesService(organizationMemberships);

    await expect(
      service.listForJobForUser('clerk_1', 'job_missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
