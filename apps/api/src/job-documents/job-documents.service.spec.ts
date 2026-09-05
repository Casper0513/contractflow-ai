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

import { JobDocumentCategory } from '@contractflow/db';

import { db } from '@contractflow/db-prisma8';

import { JobDocumentsService } from './job-documents.service';

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

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document_1',

    organizationId: 'org_1',

    jobId: 'job_1',

    uploadedByUserId: 'user_1',

    category: 'OTHER',

    title: 'Site document',

    description: 'Test document',

    originalFileName: 'document.pdf',

    mimeType: 'application/pdf',

    sizeBytes: 4096,

    storageKey: 'organizations/org_1/jobs/job_1/documents/document.pdf',

    createdAt: new Date('2026-09-04T12:00:00.000Z'),

    updatedAt: new Date('2026-09-04T12:00:00.000Z'),

    ...overrides,
  };
}

describe('JobDocumentsService Prisma 8', () => {
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

  it('lists documents with uploadedBy and storage read URL', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobDocument: makeQuery([document()]),

      User: makeQuery({
        id: 'user_1',

        firstName: 'Test',

        lastName: 'User',

        email: 'user@example.com',
      }),
    };

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.listForJobForUser('clerk_1', 'job_1');

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id: 'document_1',

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

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.createUploadUrlForUser('clerk_1', 'job_1', {
      originalFileName: 'document.pdf',

      mimeType: 'application/pdf',

      sizeBytes: 4096,
    });

    expect(result.uploadUrl).toBe('https://example.test/upload');

    expect(result.requiredHeaders).toEqual({
      'Content-Type': 'application/pdf',
    });

    expect(result.storageKey).toContain(
      'organizations/org_1/jobs/job_1/documents/',
    );
  });

  it('rejects unsupported document MIME type', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),
    };

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createUploadUrlForUser('clerk_1', 'job_1', {
        originalFileName: 'archive.zip',

        mimeType: 'application/zip',

        sizeBytes: 4096,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Unsupported document type. PDF, Word, Excel, text, CSV, JPEG, PNG, and WebP files are supported',
      ),
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

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createUploadUrlForUser('clerk_1', 'job_1', {
        originalFileName: 'document.pdf',

        mimeType: 'application/pdf',

        sizeBytes: 4096,
      }),
    ).rejects.toThrow(
      new BadRequestException('Archived jobs cannot be modified'),
    );
  });

  it('rejects duplicate registered storage keys', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobDocument: makeQuery({
        id: 'existing_document',
      }),
    };

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createForUser('clerk_1', 'job_1', {
        storageKey: 'organizations/org_1/jobs/job_1/documents/document.pdf',

        originalFileName: 'document.pdf',

        mimeType: 'application/pdf',

        sizeBytes: 4096,

        category: JobDocumentCategory.OTHER,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'This uploaded document has already been registered',
      ),
    );
  });

  it('creates JobDocument and DOCUMENT_ADDED in the same Prisma 8 transaction', async () => {
    const created = document();

    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobDocument: makeQuery(null),

      User: makeQuery({
        id: 'user_1',

        firstName: 'Test',

        lastName: 'User',

        email: 'user@example.com',
      }),
    };

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'application/pdf',

      contentLength: 4096,
    });

    const createDocument = jest.fn().mockResolvedValue(created);

    const createActivity = jest.fn().mockResolvedValue({
      id: 'activity_1',
    });

    mockedDb.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          orm: {
            public: {
              JobDocument: {
                create: createDocument,
              },

              CustomerActivity: {
                create: createActivity,
              },
            },
          },
        }),
    );

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.createForUser('clerk_1', 'job_1', {
      storageKey: 'organizations/org_1/jobs/job_1/documents/document.pdf',

      originalFileName: 'document.pdf',

      mimeType: 'application/pdf',

      sizeBytes: 4096,

      category: JobDocumentCategory.OTHER,

      title: ' Site document ',

      description: ' Test document ',
    });

    expect(createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',

        jobId: 'job_1',

        uploadedByUserId: 'user_1',

        category: JobDocumentCategory.OTHER,

        title: 'Site document',

        description: 'Test document',
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
      _type: 'DOCUMENT_ADDED',
    });

    expect(createActivityArg?.metadata).toMatchObject({
      jobId: 'job_1',
      documentId: 'document_1',
    });

    expect(result).toMatchObject({
      id: 'document_1',

      url: 'https://example.test/read',
    });
  });

  it('rejects storage metadata content-type mismatch', async () => {
    mockedDb.orm.public = {
      Job: makeQuery({
        id: 'job_1',

        customerId: 'customer_1',

        archivedAt: null,
      }),

      JobDocument: makeQuery(null),
    };

    storageService.getObjectMetadata.mockResolvedValue({
      contentType: 'text/plain',

      contentLength: 4096,
    });

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.createForUser('clerk_1', 'job_1', {
        storageKey: 'organizations/org_1/jobs/job_1/documents/document.pdf',

        originalFileName: 'document.pdf',

        mimeType: 'application/pdf',

        sizeBytes: 4096,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Uploaded document content type does not match the requested MIME type',
      ),
    );
  });

  it('deletes database document and ignores storage deletion failure', async () => {
    const deleteQuery = makeQuery(undefined);

    let whereCalls = 0;

    const documentModel = {
      where: jest.fn(),
    };

    documentModel.where.mockImplementation(() => {
      whereCalls += 1;

      if (whereCalls === 1) {
        return makeQuery({
          id: 'document_1',

          storageKey: 'organizations/org_1/jobs/job_1/documents/document.pdf',
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

      JobDocument: documentModel,
    };

    storageService.deleteObject.mockRejectedValue(new Error('Storage offline'));

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    const result = await service.deleteForUser(
      'clerk_1',
      'job_1',
      'document_1',
    );

    expect(deleteQuery.delete).toHaveBeenCalled();

    expect(storageService.deleteObject).toHaveBeenCalledWith(
      'organizations/org_1/jobs/job_1/documents/document.pdf',
    );

    expect(result).toEqual({
      success: true,
    });
  });

  it('throws Job not found for invalid job scope', async () => {
    mockedDb.orm.public = {
      Job: makeQuery(null),
    };

    const service = new JobDocumentsService(
      storageService as never,
      organizationMemberships,
    );

    await expect(
      service.listForJobForUser('clerk_1', 'missing_job'),
    ).rejects.toThrow(new NotFoundException('Job not found'));
  });
});
