import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerActivityType, Prisma, prisma } from '@contractflow/db';

import { ActivityService } from '../activity/activity.service';
import type { CreateJobContactDto } from './dto/create-job-contact.dto';
import type { UpdateJobContactDto } from './dto/update-job-contact.dto';

@Injectable()
export class JobContactsService {
  constructor(private readonly activityService: ActivityService) {}

  async listForJobForUser(clerkUserId: string, jobId: string) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireJobForOrganization(membership.organizationId, jobId);

    return prisma.jobContact.findMany({
      where: {
        organizationId: membership.organizationId,
        jobId,
      },
      orderBy: [
        {
          isPrimary: 'desc',
        },
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
      ],
      select: this.contactSelect(),
    });
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobContactDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      if (input.isPrimary) {
        await tx.jobContact.updateMany({
          where: {
            organizationId: membership.organizationId,
            jobId,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const contact = await tx.jobContact.create({
        data: {
          organizationId: membership.organizationId,
          jobId,
          firstName: this.requiredString(input.firstName),
          lastName: this.optionalString(input.lastName),
          phone: this.optionalString(input.phone),
          email: this.optionalString(input.email),
          role: this.optionalString(input.role),
          notes: this.optionalString(input.notes),
          isPrimary: input.isPrimary ?? false,
        },
        select: this.contactSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CONTACT_CREATED,
          title: 'Job contact added',
          description: `${this.contactName(contact)} was added to ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            contactId: contact.id,
            contactName: this.contactName(contact),
            isPrimary: contact.isPrimary,
          },
        },
        tx,
      );

      return contact;
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    contactId: string,
    input: UpdateJobContactDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const existingContact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx,
      );

      if (input.isPrimary === true) {
        await tx.jobContact.updateMany({
          where: {
            organizationId: membership.organizationId,
            jobId,
            id: {
              not: contactId,
            },
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const contact = await tx.jobContact.update({
        where: {
          id: contactId,
        },
        data: {
          ...(input.firstName !== undefined
            ? {
                firstName: this.requiredString(input.firstName),
              }
            : {}),
          ...(input.lastName !== undefined
            ? {
                lastName: this.optionalString(input.lastName),
              }
            : {}),
          ...(input.phone !== undefined
            ? {
                phone: this.optionalString(input.phone),
              }
            : {}),
          ...(input.email !== undefined
            ? {
                email: this.optionalString(input.email),
              }
            : {}),
          ...(input.role !== undefined
            ? {
                role: this.optionalString(input.role),
              }
            : {}),
          ...(input.notes !== undefined
            ? {
                notes: this.optionalString(input.notes),
              }
            : {}),
          ...(input.isPrimary !== undefined
            ? {
                isPrimary: input.isPrimary,
              }
            : {}),
        },
        select: this.contactSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CONTACT_UPDATED,
          title: 'Job contact updated',
          description: `${this.contactName(contact)} was updated on ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            contactId: contact.id,
            contactName: this.contactName(contact),
            previousContactName: this.contactName(existingContact),
            isPrimary: contact.isPrimary,
          },
        },
        tx,
      );

      return contact;
    });
  }

  async deleteForUser(clerkUserId: string, jobId: string, contactId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      const contact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx,
      );

      await tx.jobContact.delete({
        where: {
          id: contactId,
        },
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CONTACT_DELETED,
          title: 'Job contact deleted',
          description: `${this.contactName(contact)} was removed from ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            contactId,
            contactName: this.contactName(contact),
            wasPrimary: contact.isPrimary,
          },
        },
        tx,
      );

      return {
        success: true,
      };
    });
  }

  async setPrimaryForUser(
    clerkUserId: string,
    jobId: string,
    contactId: string,
  ) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.$transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx,
      );

      await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx,
      );

      await tx.jobContact.updateMany({
        where: {
          organizationId: membership.organizationId,
          jobId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      const contact = await tx.jobContact.update({
        where: {
          id: contactId,
        },
        data: {
          isPrimary: true,
        },
        select: this.contactSelect(),
      });

      await this.activityService.recordCustomerActivity(
        {
          organizationId: membership.organizationId,
          customerId: job.customerId,
          actorUserId: membership.userId,
          type: CustomerActivityType.JOB_CONTACT_UPDATED,
          title: 'Primary job contact changed',
          description: `${this.contactName(contact)} is now the primary contact for ${job.name}.`,
          metadata: {
            jobId,
            jobName: job.name,
            contactId: contact.id,
            contactName: this.contactName(contact),
            isPrimary: true,
          },
        },
        tx,
      );

      return contact;
    });
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
        name: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireContactForJob(
    organizationId: string,
    jobId: string,
    contactId: string,
    client: typeof prisma | Prisma.TransactionClient = prisma,
  ) {
    const contact = await client.jobContact.findFirst({
      where: {
        id: contactId,
        organizationId,
        jobId,
      },
      select: this.contactSelect(),
    });

    if (!contact) {
      throw new NotFoundException('Job contact not found');
    }

    return contact;
  }

  private async getMembership(clerkUserId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },
      select: {
        organizationId: true,
        userId: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    return membership;
  }

  private contactSelect(): Prisma.JobContactSelect {
    return {
      id: true,
      organizationId: true,
      jobId: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      role: true,
      notes: true,
      isPrimary: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  private requiredString(value: string) {
    return value.trim();
  }

  private optionalString(value: string | undefined) {
    const normalized = value?.trim();

    return normalized ? normalized : null;
  }

  private contactName(contact: { firstName: string; lastName: string | null }) {
    return [contact.firstName, contact.lastName].filter(Boolean).join(' ');
  }
}
