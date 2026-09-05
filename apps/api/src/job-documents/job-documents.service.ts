import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JobDocumentCategory } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { randomUUID } from 'node:crypto';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { StorageService } from '../storage/storage.service';

import type { CreateJobDocumentDto } from './dto/create-job-document.dto';
import type { CreateJobDocumentUploadDto } from './dto/create-job-document-upload.dto';

const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',

  'application/msword': 'doc',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',

  'application/vnd.ms-excel': 'xls',

  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',

  'text/plain': 'txt',

  'text/csv': 'csv',

  'image/jpeg': 'jpg',

  'image/png': 'png',

  'image/webp': 'webp',
};

type OrmSource = typeof db.orm;

type JobRecord = {
  id: string;
  customerId: string;

  archivedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;
};

type JobDocumentRecord = {
  id: string;

  organizationId: string;
  jobId: string;

  uploadedByUserId: string | null;

  category:
    'CONTRACT' | 'PERMIT' | 'RECEIPT' | 'DRAWING' | 'WARRANTY' | 'OTHER';

  title: string | null;

  description: string | null;

  originalFileName: string;

  mimeType: string;

  sizeBytes: number;

  storageKey: string;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobDocumentsService {
  private readonly logger = new Logger(JobDocumentsService.name);

  constructor(
    private readonly storageService: StorageService,

    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForJobForUser(
    clerkUserId: string,
    jobId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireJobForOrganization(membership.organizationId, jobId);

    const documents = await db.orm.public.JobDocument.where({
      organizationId: membership.organizationId,

      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'uploadedByUserId',
        'category',
        'title',
        'description',
        'originalFileName',
        'mimeType',
        'sizeBytes',
        'storageKey',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    return Promise.all(
      documents.map(async (document) => {
        const hydrated = await this.hydrateDocument(db.orm, document);

        const read = await this.storageService.createReadUrl(
          document.storageKey,
        );

        return {
          ...hydrated,

          url: read.url,

          urlExpiresInSeconds: read.expiresInSeconds,
        };
      }),
    );
  }

  async createUploadUrlForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobDocumentUploadDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await this.requireJobForOrganization(
      membership.organizationId,
      jobId,
    );

    this.requireMutableJob(job);

    this.validateDocumentFile({
      mimeType: input.mimeType,

      sizeBytes: input.sizeBytes,
    });

    const extension = EXTENSION_BY_MIME_TYPE[input.mimeType];

    if (!extension) {
      throw new BadRequestException('Unsupported document type');
    }

    const storageKey = this.buildStorageKey({
      organizationId: membership.organizationId,

      jobId,

      extension,
    });

    const upload = await this.storageService.createUploadUrl({
      storageKey,

      contentType: input.mimeType,
    });

    return {
      storageKey,

      uploadUrl: upload.url,

      expiresInSeconds: upload.expiresInSeconds,

      requiredHeaders: {
        'Content-Type': input.mimeType,
      },
    };
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobDocumentDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await this.requireJobForOrganization(
      membership.organizationId,
      jobId,
    );

    this.requireMutableJob(job);

    this.validateStorageKey(membership.organizationId, jobId, input.storageKey);

    this.validateDocumentFile({
      mimeType: input.mimeType,

      sizeBytes: input.sizeBytes,
    });

    const existing = await db.orm.public.JobDocument.where({
      storageKey: input.storageKey,
    })
      .select('id')
      .first();

    if (existing) {
      throw new BadRequestException(
        'This uploaded document has already been registered',
      );
    }

    let objectMetadata: {
      contentType: string | null;

      contentLength: number | null;
    };

    try {
      objectMetadata = await this.storageService.getObjectMetadata(
        input.storageKey,
      );
    } catch {
      throw new BadRequestException(
        'Uploaded document could not be found in object storage',
      );
    }

    if (
      objectMetadata.contentType &&
      objectMetadata.contentType !== input.mimeType
    ) {
      throw new BadRequestException(
        'Uploaded document content type does not match the requested MIME type',
      );
    }

    if (
      objectMetadata.contentLength !== null &&
      objectMetadata.contentLength !== input.sizeBytes
    ) {
      throw new BadRequestException(
        'Uploaded document size does not match the requested file size',
      );
    }

    this.validateDocumentFile({
      mimeType: objectMetadata.contentType ?? input.mimeType,

      sizeBytes: objectMetadata.contentLength ?? input.sizeBytes,
    });

    const document = await db.transaction(async (tx) => {
      const now = toPrisma8Timestamp();

      const createdDocument = await tx.orm.public.JobDocument.create({
        organizationId: membership.organizationId,

        jobId,

        uploadedByUserId: membership.userId,

        category: input.category ?? JobDocumentCategory.OTHER,

        title: clean(input.title) ?? null,

        description: clean(input.description) ?? null,

        originalFileName: input.originalFileName.trim(),

        mimeType: input.mimeType,

        sizeBytes: input.sizeBytes,

        storageKey: input.storageKey,

        createdAt: now,

        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'DOCUMENT_ADDED',

        title: 'Job document added',

        description: `${input.originalFileName.trim()} was added to the job.`,

        metadata: {
          jobId,

          documentId: createdDocument.id,

          category: createdDocument.category,

          originalFileName: createdDocument.originalFileName,
        },

        createdAt: now,
      });

      return createdDocument;
    });

    const hydrated = await this.hydrateDocument(db.orm, document);

    const read = await this.storageService.createReadUrl(document.storageKey);

    return {
      ...hydrated,

      url: read.url,

      urlExpiresInSeconds: read.expiresInSeconds,
    };
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    documentId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const job = await this.requireJobForOrganization(
      membership.organizationId,
      jobId,
    );

    this.requireMutableJob(job);

    const document = await this.requireDocumentForJob(
      membership.organizationId,
      jobId,
      documentId,
    );

    await db.orm.public.JobDocument.where({
      id: document.id,
    }).delete();

    try {
      await this.storageService.deleteObject(document.storageKey);
    } catch (error) {
      this.logger.error(
        `Failed to delete job document object ${document.storageKey}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      success: true,
    };
  }

  private validateDocumentFile(input: { mimeType: string; sizeBytes: number }) {
    if (!ALLOWED_DOCUMENT_TYPES.has(input.mimeType)) {
      throw new BadRequestException(
        'Unsupported document type. PDF, Word, Excel, text, CSV, JPEG, PNG, and WebP files are supported',
      );
    }

    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BadRequestException('Document file size is invalid');
    }

    if (input.sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('Document must be 25 MB or smaller');
    }
  }

  private validateStorageKey(
    organizationId: string,
    jobId: string,
    storageKey: string,
  ) {
    const prefix = this.storagePrefix(organizationId, jobId);

    if (!storageKey.startsWith(prefix)) {
      throw new BadRequestException(
        'Document storage key does not belong to this job',
      );
    }

    const remaining = storageKey.slice(prefix.length);

    if (!remaining || remaining.includes('/')) {
      throw new BadRequestException('Document storage key is invalid');
    }
  }

  private buildStorageKey(input: {
    organizationId: string;
    jobId: string;
    extension: string;
  }) {
    return `${this.storagePrefix(
      input.organizationId,
      input.jobId,
    )}${randomUUID()}.${input.extension}`;
  }

  private storagePrefix(organizationId: string, jobId: string) {
    return `organizations/${organizationId}/jobs/${jobId}/documents/`;
  }

  private requireMutableJob(job: JobRecord) {
    if (job.archivedAt) {
      throw new BadRequestException('Archived jobs cannot be modified');
    }
  }

  private async requireJobForOrganization(
    organizationId: string,
    jobId: string,
    orm: OrmSource = db.orm,
  ) {
    const job = await orm.public.Job.where({
      id: jobId,

      organizationId,
    })
      .select('id', 'customerId', 'archivedAt')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireDocumentForJob(
    organizationId: string,
    jobId: string,
    documentId: string,
  ) {
    const document = await db.orm.public.JobDocument.where({
      id: documentId,

      organizationId,

      jobId,
    })
      .select('id', 'storageKey')
      .first();

    if (!document) {
      throw new NotFoundException('Job document not found');
    }

    return document;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateDocument(orm: OrmSource, document: JobDocumentRecord) {
    const uploadedBy = document.uploadedByUserId
      ? await orm.public.User.where({
          id: document.uploadedByUserId,
        })
          .select('id', 'firstName', 'lastName', 'email')
          .first()
      : null;

    return {
      id: document.id,

      organizationId: document.organizationId,

      jobId: document.jobId,

      uploadedByUserId: document.uploadedByUserId,

      category: document.category,

      title: document.title,

      description: document.description,

      originalFileName: document.originalFileName,

      mimeType: document.mimeType,

      sizeBytes: document.sizeBytes,

      storageKey: document.storageKey,

      createdAt: fromPrisma8Timestamp(document.createdAt),

      updatedAt: fromPrisma8Timestamp(document.updatedAt),

      uploadedBy,
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
