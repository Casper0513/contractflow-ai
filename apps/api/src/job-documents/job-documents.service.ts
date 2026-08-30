import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  JobDocumentCategory,
  Prisma,
  prisma,
} from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { randomUUID } from 'node:crypto';

import { StorageService } from '../storage/storage.service';
import type { CreateJobDocumentDto } from './dto/create-job-document.dto';
import type { CreateJobDocumentUploadDto } from './dto/create-job-document-upload.dto';
import { ActivityService } from '../activity/activity.service';

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

@Injectable()
export class JobDocumentsService {
  private readonly logger = new Logger(JobDocumentsService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}
  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    const documents = await prisma.jobDocument.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: this.documentSelect(),
    });

    return Promise.all(
      documents.map(async (document) => {
        const read = await this.storageService.createReadUrl(
          document.storageKey,
        );

        return {
          ...document,

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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

    const existing = await prisma.jobDocument.findUnique({
      where: {
        storageKey: input.storageKey,
      },

      select: {
        id: true,
      },
    });

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

    const document = await prisma.$transaction(async (tx) => {
      const createdDocument = await tx.jobDocument.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          uploadedByUserId: membership.userId,
          category: input.category ?? JobDocumentCategory.OTHER,
          title: clean(input.title),
          description: clean(input.description),
          originalFileName: input.originalFileName.trim(),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
        },
        select: this.documentSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.DOCUMENT_ADDED,
          title: 'Job document added',
          description: `${input.originalFileName.trim()} was added to the job.`,
          metadata: {
            jobId,
            documentId: createdDocument.id,
            category: createdDocument.category,
            originalFileName: createdDocument.originalFileName,
          },
        },
        tx,
      );

      return createdDocument;
    });
    const read = await this.storageService.createReadUrl(document.storageKey);

    return {
      ...document,

      url: read.url,

      urlExpiresInSeconds: read.expiresInSeconds,
    };
  }

  async deleteForUser(clerkUserId: string, jobId: string, documentId: string) {
    const membership = await this.getMembership(clerkUserId);

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

    await prisma.jobDocument.delete({
      where: {
        id: document.id,
      },
    });

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

  private requireMutableJob(job: { archivedAt: Date | null }) {
    if (job.archivedAt) {
      throw new BadRequestException('Archived jobs cannot be modified');
    }
  }

  private async requireJobForOrganization(
    organizationId: string,
    jobId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const job = await client.job.findFirst({
      where: {
        id: jobId,
        organizationId,
      },

      select: {
        id: true,
        customerId: true,
        archivedAt: true,
      },
    });

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
    const document = await prisma.jobDocument.findFirst({
      where: {
        id: documentId,
        organizationId,
        jobId,
      },

      select: {
        id: true,
        storageKey: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Job document not found');
    }

    return document;
  }

  private getMembership(clerkUserId: string) {
    return this.organizationMemberships.resolveForUser(clerkUserId);
  }

  private documentSelect(): Prisma.JobDocumentSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      uploadedByUserId: true,

      category: true,

      title: true,
      description: true,

      originalFileName: true,
      mimeType: true,
      sizeBytes: true,

      storageKey: true,

      createdAt: true,
      updatedAt: true,

      uploadedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
