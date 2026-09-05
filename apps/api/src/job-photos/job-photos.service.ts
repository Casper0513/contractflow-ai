import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JobPhotoCategory } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { randomUUID } from 'node:crypto';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { StorageService } from '../storage/storage.service';

import type { CreateJobPhotoDto } from './dto/create-job-photo.dto';
import type { CreateJobPhotoUploadDto } from './dto/create-job-photo-upload.dto';

const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
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

type JobPhotoRecord = {
  id: string;

  organizationId: string;
  jobId: string;

  uploadedByUserId: string | null;

  category: 'BEFORE' | 'PROGRESS' | 'AFTER' | 'ISSUE' | 'OTHER';

  caption: string | null;

  originalFileName: string;

  mimeType: string;

  sizeBytes: number;

  storageKey: string;

  width: number | null;

  height: number | null;

  takenAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobPhotosService {
  private readonly logger = new Logger(JobPhotosService.name);

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

    const photos = await db.orm.public.JobPhoto.where({
      organizationId: membership.organizationId,

      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'uploadedByUserId',
        'category',
        'caption',
        'originalFileName',
        'mimeType',
        'sizeBytes',
        'storageKey',
        'width',
        'height',
        'takenAt',
        'createdAt',
        'updatedAt',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    return Promise.all(
      photos.map(async (photo) => {
        const hydrated = await this.hydratePhoto(db.orm, photo);

        const read = await this.storageService.createReadUrl(photo.storageKey);

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
    input: CreateJobPhotoUploadDto,
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

    this.validatePhotoFile({
      mimeType: input.mimeType,

      sizeBytes: input.sizeBytes,
    });

    const extension = EXTENSION_BY_MIME_TYPE[input.mimeType];

    if (!extension) {
      throw new BadRequestException('Unsupported photo type');
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
    input: CreateJobPhotoDto,
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

    this.validatePhotoFile({
      mimeType: input.mimeType,

      sizeBytes: input.sizeBytes,
    });

    const existing = await db.orm.public.JobPhoto.where({
      storageKey: input.storageKey,
    })
      .select('id')
      .first();

    if (existing) {
      throw new BadRequestException(
        'This uploaded photo has already been registered',
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
        'Uploaded photo could not be found in object storage',
      );
    }

    if (
      objectMetadata.contentType &&
      objectMetadata.contentType !== input.mimeType
    ) {
      throw new BadRequestException(
        'Uploaded photo content type does not match the requested MIME type',
      );
    }

    if (
      objectMetadata.contentLength !== null &&
      objectMetadata.contentLength !== input.sizeBytes
    ) {
      throw new BadRequestException(
        'Uploaded photo size does not match the requested file size',
      );
    }

    this.validatePhotoFile({
      mimeType: objectMetadata.contentType ?? input.mimeType,

      sizeBytes: objectMetadata.contentLength ?? input.sizeBytes,
    });

    const photo = await db.transaction(async (tx) => {
      const now = toPrisma8Timestamp();

      const createdPhoto = await tx.orm.public.JobPhoto.create({
        organizationId: membership.organizationId,

        jobId,

        uploadedByUserId: membership.userId,

        category: input.category ?? JobPhotoCategory.PROGRESS,

        caption: clean(input.caption) ?? null,

        originalFileName: input.originalFileName.trim(),

        mimeType: input.mimeType,

        sizeBytes: input.sizeBytes,

        storageKey: input.storageKey,

        width: input.width ?? null,

        height: input.height ?? null,

        takenAt: input.takenAt
          ? toPrisma8Timestamp(new Date(input.takenAt))
          : null,

        createdAt: now,

        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'PHOTO_ADDED',

        title: 'Job photo added',

        description: `${input.originalFileName.trim()} was added to the job.`,

        metadata: {
          jobId,

          photoId: createdPhoto.id,

          category: createdPhoto.category,

          originalFileName: createdPhoto.originalFileName,
        },

        createdAt: now,
      });

      return createdPhoto;
    });

    const hydrated = await this.hydratePhoto(db.orm, photo);

    const read = await this.storageService.createReadUrl(photo.storageKey);

    return {
      ...hydrated,

      url: read.url,

      urlExpiresInSeconds: read.expiresInSeconds,
    };
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    photoId: string,
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

    const photo = await this.requirePhotoForJob(
      membership.organizationId,
      jobId,
      photoId,
    );

    await db.orm.public.JobPhoto.where({
      id: photo.id,
    }).delete();

    try {
      await this.storageService.deleteObject(photo.storageKey);
    } catch (error) {
      this.logger.error(
        `Failed to delete job photo object ${photo.storageKey}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return {
      success: true,
    };
  }

  private validatePhotoFile(input: { mimeType: string; sizeBytes: number }) {
    if (!ALLOWED_PHOTO_TYPES.has(input.mimeType)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WebP photos are supported',
      );
    }

    if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw new BadRequestException('Photo file size is invalid');
    }

    if (input.sizeBytes > MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException('Photo must be 15 MB or smaller');
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
        'Photo storage key does not belong to this job',
      );
    }

    const remaining = storageKey.slice(prefix.length);

    if (!remaining || remaining.includes('/')) {
      throw new BadRequestException('Photo storage key is invalid');
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
    return `organizations/${organizationId}/jobs/${jobId}/photos/`;
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

  private async requirePhotoForJob(
    organizationId: string,
    jobId: string,
    photoId: string,
  ) {
    const photo = await db.orm.public.JobPhoto.where({
      id: photoId,

      organizationId,

      jobId,
    })
      .select('id', 'storageKey')
      .first();

    if (!photo) {
      throw new NotFoundException('Job photo not found');
    }

    return photo;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydratePhoto(orm: OrmSource, photo: JobPhotoRecord) {
    const uploadedBy = photo.uploadedByUserId
      ? await orm.public.User.where({
          id: photo.uploadedByUserId,
        })
          .select('id', 'firstName', 'lastName', 'email')
          .first()
      : null;

    return {
      id: photo.id,

      organizationId: photo.organizationId,

      jobId: photo.jobId,

      uploadedByUserId: photo.uploadedByUserId,

      category: photo.category,

      caption: photo.caption,

      originalFileName: photo.originalFileName,

      mimeType: photo.mimeType,

      sizeBytes: photo.sizeBytes,

      storageKey: photo.storageKey,

      width: photo.width,

      height: photo.height,

      takenAt:
        photo.takenAt === null ? null : fromPrisma8Timestamp(photo.takenAt),

      createdAt: fromPrisma8Timestamp(photo.createdAt),

      updatedAt: fromPrisma8Timestamp(photo.updatedAt),

      uploadedBy,
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}
