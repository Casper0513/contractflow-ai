import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  prisma8TimestampParam,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateJobContactDto } from './dto/create-job-contact.dto';
import type { UpdateJobContactDto } from './dto/update-job-contact.dto';

type OrmSource = typeof db.orm;

type JobContactRecord = {
  id: string;
  organizationId: string;
  jobId: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  notes: string | null;
  isPrimary: boolean;
  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class JobContactsService {
  constructor(
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

    /*
     * Prisma 8 RC does not currently expose .desc()
     * for boolean fields, so fetch the contacts and
     * preserve the existing Prisma 7 ordering here:
     *
     * 1. primary first
     * 2. firstName ascending
     * 3. lastName ascending
     */
    const contacts = await db.orm.public.JobContact.where({
      organizationId: membership.organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'firstName',
        'lastName',
        'phone',
        'email',
        'role',
        'notes',
        'isPrimary',
        'createdAt',
        'updatedAt',
      )
      .all();

    contacts.sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) {
        return left.isPrimary ? -1 : 1;
      }

      const firstNameComparison = left.firstName.localeCompare(right.firstName);

      if (firstNameComparison !== 0) {
        return firstNameComparison;
      }

      return (left.lastName ?? '').localeCompare(right.lastName ?? '');
    });

    return contacts.map((contact) => this.toOutput(contact));
  }

  async createForUser(
    clerkUserId: string,
    jobId: string,
    input: CreateJobContactDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      if (input.isPrimary) {
        await this.demotePrimaryContacts(tx, membership.organizationId, jobId);
      }

      const now = toPrisma8Timestamp();

      const contact = await tx.orm.public.JobContact.create({
        organizationId: membership.organizationId,
        jobId,

        firstName: this.requiredString(input.firstName),

        lastName: this.optionalString(input.lastName),

        phone: this.optionalString(input.phone),

        email: this.optionalString(input.email),

        role: this.optionalString(input.role),

        notes: this.optionalString(input.notes),

        isPrimary: input.isPrimary ?? false,

        createdAt: now,

        updatedAt: now,
      });

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_CONTACT_CREATED',

        title: 'Job contact added',

        description: `${this.contactName(contact)} was added to ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          contactId: contact.id,

          contactName: this.contactName(contact),

          isPrimary: contact.isPrimary,
        },
      });

      return this.toOutput(contact);
    });
  }

  async updateForUser(
    clerkUserId: string,
    jobId: string,
    contactId: string,
    input: UpdateJobContactDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const existingContact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx.orm,
      );

      if (input.isPrimary === true) {
        await this.demotePrimaryContacts(tx, membership.organizationId, jobId);
      }

      const now = toPrisma8Timestamp();

      const updateData: {
        firstName?: string;
        lastName?: string | null;
        phone?: string | null;
        email?: string | null;
        role?: string | null;
        notes?: string | null;
        isPrimary?: boolean;
        updatedAt: ReturnType<typeof toPrisma8Timestamp>;
      } = {
        updatedAt: now,
      };

      if (input.firstName !== undefined) {
        updateData.firstName = this.requiredString(input.firstName);
      }

      if (input.lastName !== undefined) {
        updateData.lastName = this.optionalString(input.lastName);
      }

      if (input.phone !== undefined) {
        updateData.phone = this.optionalString(input.phone);
      }

      if (input.email !== undefined) {
        updateData.email = this.optionalString(input.email);
      }

      if (input.role !== undefined) {
        updateData.role = this.optionalString(input.role);
      }

      if (input.notes !== undefined) {
        updateData.notes = this.optionalString(input.notes);
      }

      if (input.isPrimary !== undefined) {
        updateData.isPrimary = input.isPrimary;
      }

      await tx.orm.public.JobContact.where({
        id: contactId,
      }).update(updateData);

      const contact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx.orm,
      );

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_CONTACT_UPDATED',

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
      });

      return this.toOutput(contact);
    });
  }

  async deleteForUser(
    clerkUserId: string,
    jobId: string,
    contactId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      const contact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx.orm,
      );

      await tx.orm.public.JobContact.where({
        id: contactId,
      }).delete();

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_CONTACT_DELETED',

        title: 'Job contact deleted',

        description: `${this.contactName(contact)} was removed from ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          contactId,

          contactName: this.contactName(contact),

          wasPrimary: contact.isPrimary,
        },
      });

      return {
        success: true,
      };
    });
  }

  async setPrimaryForUser(
    clerkUserId: string,
    jobId: string,
    contactId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return db.transaction(async (tx) => {
      const job = await this.requireJobForOrganization(
        membership.organizationId,
        jobId,
        tx.orm,
      );

      await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx.orm,
      );

      await this.demotePrimaryContacts(tx, membership.organizationId, jobId);

      await tx.orm.public.JobContact.where({
        id: contactId,
      }).update({
        isPrimary: true,

        updatedAt: toPrisma8Timestamp(),
      });

      const contact = await this.requireContactForJob(
        membership.organizationId,
        jobId,
        contactId,
        tx.orm,
      );

      await tx.orm.public.CustomerActivity.create({
        organizationId: membership.organizationId,

        customerId: job.customerId,

        actorUserId: membership.userId,

        _type: 'JOB_CONTACT_UPDATED',

        title: 'Primary job contact changed',

        description: `${this.contactName(contact)} is now the primary contact for ${job.name}.`,

        metadata: {
          jobId,

          jobName: job.name,

          contactId: contact.id,

          contactName: this.contactName(contact),

          isPrimary: true,
        },
      });

      return this.toOutput(contact);
    });
  }

  private async demotePrimaryContacts(
    tx: DatabaseTransaction,
    organizationId: string,
    jobId: string,
  ) {
    /*
     * Prisma 8 RC's ORM .update() is not
     * equivalent to Prisma 7 updateMany().
     *
     * This raw UPDATE preserves the old
     * multi-row behavior atomically inside
     * the same Prisma 8 transaction.
     */
    const now = prisma8TimestampParam(toPrisma8Timestamp());

    const plan = db.raw.sql`
        UPDATE "JobContact"
        SET
          "isPrimary" = false,
          "updatedAt" = ${now}
        WHERE
          "organizationId" = ${organizationId}
          AND "jobId" = ${jobId}
          AND "isPrimary" = true
      `
      .affectedCount()
      .build();

    await tx.execute(plan);
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
      .select('id', 'customerId', 'name')
      .first();

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  private async requireContactForJob(
    organizationId: string,
    jobId: string,
    contactId: string,
    orm: OrmSource = db.orm,
  ) {
    const contact = await orm.public.JobContact.where({
      id: contactId,
      organizationId,
      jobId,
    })
      .select(
        'id',
        'organizationId',
        'jobId',
        'firstName',
        'lastName',
        'phone',
        'email',
        'role',
        'notes',
        'isPrimary',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!contact) {
      throw new NotFoundException('Job contact not found');
    }

    return contact;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private toOutput(contact: JobContactRecord) {
    return {
      id: contact.id,

      organizationId: contact.organizationId,

      jobId: contact.jobId,

      firstName: contact.firstName,

      lastName: contact.lastName,

      phone: contact.phone,

      email: contact.email,

      role: contact.role,

      notes: contact.notes,

      isPrimary: contact.isPrimary,

      createdAt: fromPrisma8Timestamp(contact.createdAt),

      updatedAt: fromPrisma8Timestamp(contact.updatedAt),
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
