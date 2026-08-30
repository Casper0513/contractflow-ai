import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerActivityType,
  JobPhotoCategory,
  Prisma,
  prisma,
} from '@contractflow/db';

import { OrganizationMembershipService } from '../auth/organization-membership.service';
import { randomUUID } from 'node:crypto';

import { StorageService } from '../storage/storage.service';
import type { CreateJobPhotoDto } from './dto/create-job-photo.dto';
import type { CreateJobPhotoUploadDto } from './dto/create-job-photo-upload.dto';
import { ActivityService } from '../activity/activity.service';

const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class JobPhotosService {
  private readonly logger = new Logger(JobPhotosService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}
  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    const photos = await prisma.jobPhoto.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: this.photoSelect(),
    });

    return Promise.all(
      photos.map(async (photo) => {
        const read = await this.storageService.createReadUrl(photo.storageKey);

        return {
          ...photo,

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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

    const existing = await prisma.jobPhoto.findUnique({
      where: {
        storageKey: input.storageKey,
      },

      select: {
        id: true,
      },
    });

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

    const photo = await prisma.$transaction(async (tx) => {
      const createdPhoto = await tx.jobPhoto.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          uploadedByUserId: membership.userId,
          category: input.category ?? JobPhotoCategory.PROGRESS,
          caption: clean(input.caption),
          originalFileName: input.originalFileName.trim(),
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storageKey: input.storageKey,
          width: input.width ?? null,
          height: input.height ?? null,
          takenAt: input.takenAt ? new Date(input.takenAt) : null,
        },
        select: this.photoSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.PHOTO_ADDED,
          title: 'Job photo added',
          description: `${input.originalFileName.trim()} was added to the job.`,
          metadata: {
            jobId,
            photoId: createdPhoto.id,
            category: createdPhoto.category,
            originalFileName: createdPhoto.originalFileName,
          },
        },
        tx,
      );

      return createdPhoto;
    });

    const read = await this.storageService.createReadUrl(photo.storageKey);

    return {
      ...photo,

      url: read.url,

      urlExpiresInSeconds: read.expiresInSeconds,
    };
  }

  async deleteForUser(clerkUserId: string, jobId: string, photoId: string) {
    const membership = await this.getMembership(clerkUserId);

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

    await prisma.jobPhoto.delete({
      where: {
        id: photo.id,
      },
    });

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

  private async requirePhotoForJob(
    organizationId: string,
    jobId: string,
    photoId: string,
  ) {
    const photo = await prisma.jobPhoto.findFirst({
      where: {
        id: photoId,
        organizationId,
        jobId,
      },

      select: {
        id: true,
        storageKey: true,
      },
    });

    if (!photo) {
      throw new NotFoundException('Job photo not found');
    }

    return photo;
  }

  private getMembership(clerkUserId: string) {
    return this.organizationMemberships.resolveForUser(clerkUserId);
  }

  private photoSelect(): Prisma.JobPhotoSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      uploadedByUserId: true,

      category: true,
      caption: true,

      originalFileName: true,
      mimeType: true,
      sizeBytes: true,

      storageKey: true,

      width: true,
      height: true,

      takenAt: true,

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
