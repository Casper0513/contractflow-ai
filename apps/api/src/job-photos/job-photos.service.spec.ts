jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: jest.fn(),

    orm: {
      public: {},
    },
  },

  fromPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T12:00:00.000Z'),
  ),

  toPrisma8Timestamp: jest.fn((value) =>
    value instanceof Date ? value : new Date('2026-09-04T12:00:00.000Z'),
  ),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';

import { JobPhotoCategory } from '@contractflow/db';

import { db } from '@contractflow/db-prisma8';

import { JobPhotosService } from './job-photos.service';

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

function photo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'photo_1',

    organizationId: 'org_1',

    jobId: 'job_1',

    uploadedByUserId: 'user_1',

    category: 'PROGRESS',

    caption: 'Progress photo',

    originalFileName: 'photo.jpg',

    mimeType: 'image/jpeg',

    sizeBytes: 2048,

    storageKey: 'organizations/org_1/jobs/job_1/photos/photo.jpg',

    width: 1280,

    height: 720,

    takenAt: new Date('2026-09-04T11:00:00.000Z'),

    createdAt: new Date('2026-09-04T12:00:00.000Z'),

    updatedAt: new Date('2026-09-04T12:00:00.000Z'),

    ...overrides,
  };
}

describe('JobPhotosService Prisma 8', () => {
  const mockedDb = db as unknown as {
    transaction: jest.Mock;

    orm: {
      public: Record<string, unknown>;
    };
  };

  const storageService = {
    createReadUrl: jest.fn(),

    createUploadUrl: jest.fn(),

    getObjectMetadata: jest.fn(),

    deleteObject: jest.fn(),
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

    storageService.createReadUrl.mockResolvedValue({
      url: 'https://example.test/read',

      expiresInSeconds: 900,
    });
  });

  it('lists photos with uploadedBy and storage read URL', async () => {
    const listed = photo();

    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobPhoto: makeQuery([listed]),

      User: makeQuery({
        id: 'user_1',

        firstName: 'Test',

        lastName: 'User',

        email: 'user@example.com',
      }),
    };

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.listForJobForUser('clerk_1', 'job_1');

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id: 'photo_1',

      uploadedBy: {
        id: 'user_1',
      },

      url: 'https://example.test/read',

      urlExpiresInSeconds: 900,
    });

    expect(result[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('creates an upload URL for a mutable job', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),
    };

    storageService.createUploadUrl.mockResolvedValue({
      url: 'https://example.test/upload',

      expiresInSeconds: 600,
    });

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.createUploadUrlForUser('clerk_1', 'job_1', {
      originalFileName: 'photo.jpg',

      mimeType: 'image/jpeg',

      sizeBytes: 2048,
    });

    expect(result.uploadUrl).toBe('https://example.test/upload');

    expect(result.requiredHeaders).toEqual({
      'Content-Type': 'image/jpeg',
    });

    expect(result.storageKey).toContain(
      'organizations/org_1/jobs/job_1/photos/',
    );
  });

  it('rejects an unsupported photo MIME type', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),
    };

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createUploadUrlForUser('clerk_1', 'job_1', {
        originalFileName: 'photo.gif',

        mimeType: 'image/gif',

        sizeBytes: 2048,
      }),
    ).rejects.toThrow(
      new BadRequestException('Only JPEG, PNG, and WebP photos are supported'),
    );
  });

  it('rejects modifications to archived jobs', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: new Date(),
      }),
    };

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createUploadUrlForUser('clerk_1', 'job_1', {
        originalFileName: 'photo.jpg',

        mimeType: 'image/jpeg',

        sizeBytes: 2048,
      }),
    ).rejects.toThrow(
      new BadRequestException('Archived jobs cannot be modified'),
    );
  });

  it('rejects duplicate registered storage keys', async () => {
    const jobQuery = makeQuery({
      id: 'job_1',

      customerId: 'customer_1',

      archivedAt: null,
    });

    const photoQuery = makeQuery({
      id: 'existing_photo',
    });

    mockedDb.orm.public = {
      Job: jobQuery,

      JobPhoto: photoQuery,
    };

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createForUser('clerk_1', 'job_1', {
        storageKey: 'organizations/org_1/jobs/job_1/photos/photo.jpg',

        originalFileName: 'photo.jpg',

        mimeType: 'image/jpeg',

        sizeBytes: 2048,

        category: JobPhotoCategory.PROGRESS,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'This uploaded photo has already been registered',
      ),
    );
  });

  it('creates JobPhoto and PHOTO_ADDED in the same Prisma 8 transaction', async () => {
    const created = photo();

    const jobQuery = makeQuery({
      id: 'job_1',

      customerId: 'customer_1',

      archivedAt: null,
    });

    const duplicateQuery = makeQuery(null);

    mockedDb.orm.public = {
      Job: jobQuery,

      JobPhoto: duplicateQuery,

      User: makeQuery({
        id: 'user_1',

        firstName: 'Test',

        lastName: 'User',

        email: 'user@example.com',
      }),
    };

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/jpeg',

      contentLength: 2048,
    });

    const createPhoto = jest.fn().mockResolvedValue(created);

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          orm: {
            public: {
              JobPhoto: {
                create: createPhoto,
              },

              CustomerActivity: {
                create: createActivity,
              },
            },
          },
        }),
    );

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.createForUser('clerk_1', 'job_1', {
      storageKey: 'organizations/org_1/jobs/job_1/photos/photo.jpg',

      originalFileName: 'photo.jpg',

      mimeType: 'image/jpeg',

      sizeBytes: 2048,

      category: JobPhotoCategory.PROGRESS,

      caption: 'Progress photo',
    });

    expect(createPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        jobId: 'job_1',

        uploadedByUserId: 'user_1',

        category: JobPhotoCategory.PROGRESS,
      }),
    );

    expect(createActivity).toHaveBeenCalledTimes(1);

    const createActivityCalls = createActivity.mock.calls as Array<
      [
        {
          organizationId?: string;
          customerId?: string;
          actorUserId?: string | null;
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createActivityArg = createActivityCalls[0]?.[0];

    expect(createActivityArg).toMatchObject({
      organizationId: 'org_1',
      customerId: 'customer_1',
      actorUserId: 'user_1',
      _type: 'PHOTO_ADDED',
    });

    expect(createActivityArg?.metadata).toMatchObject({
      jobId: 'job_1',
      photoId: 'photo_1',
    });

    expect(result).toMatchObject({
      id: 'photo_1',

      url: 'https://example.test/read',
    });
  });

  it('rejects storage metadata mismatch', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobPhoto: makeQuery(null),
    };

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'image/png',

      contentLength: 2048,
    });

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createForUser('clerk_1', 'job_1', {
        storageKey: 'organizations/org_1/jobs/job_1/photos/photo.jpg',

        originalFileName: 'photo.jpg',

        mimeType: 'image/jpeg',

        sizeBytes: 2048,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Uploaded photo content type does not match the requested MIME type',
      ),
    );
  });

  it('deletes database photo and ignores storage deletion failure', async () => {
    const deleteQuery = makeQuery(undefined);

    let photoWhereCalls = 0;

    const photoModel = {
      where: jest.fn(),
    };

    photoModel.where.mockImplementation(() => {
      photoWhereCalls += 1;

      if (photoWhereCalls === 1) {
        return makeQuery({
          id: 'photo_1',

          storageKey: 'organizations/org_1/jobs/job_1/photos/photo.jpg',
        });
      }

      return deleteQuery;
    });

    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobPhoto: photoModel,
    };

    storageService.deleteObject.mockRejectedValue(new Error('Storage offline'));

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.deleteForUser('clerk_1', 'job_1', 'photo_1');

    expect(deleteQuery.delete).toHaveBeenCalled();

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'organizations/org_1/jobs/job_1/photos/photo.jpg',
    );

    expect(result).toEqual({
      success: true,
    });
  });

  it('throws Job not found for invalid job scope', async () => {
    mockedDb.orm.public = {
      Job: makeQuery(null),
    };

    const service = new JobPhotosService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.listForJobForUser('clerk_1', 'missing_job'),
    ).rejects.toThrow(new NotFoundException('Job not found'));
  });
});
