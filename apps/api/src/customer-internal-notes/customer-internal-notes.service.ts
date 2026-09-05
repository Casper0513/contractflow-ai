import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerInternalNoteKind, NotificationType } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import { NotificationsService } from '../notifications/notifications.service';
import type { CreateCustomerInternalNoteDto } from './dto/create-customer-internal-note.dto';
import type { UpdateCustomerInternalNoteDto } from './dto/update-customer-internal-note.dto';

@Injectable()
export class CustomerInternalNotesService {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForCustomerForUser(
    clerkUserId: string,
    customerId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const notes = await db.orm.public.CustomerInternalNote.where({
      organizationId: membership.organizationId,

      customerId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'kind',
        'content',
        'createdByUserId',
        'assignedToUserId',
        'dueAt',
        'completedAt',
        'completedByUserId',
        'createdAt',
        'updatedAt',
      )
      .all();

    const hydrated = [];

    for (const note of notes) {
      hydrated.push(await this.hydrateNotePrisma8(note));
    }

    hydrated.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return hydrated;
  }

  async listFollowUpsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const notes = await db.orm.public.CustomerInternalNote.where({
      organizationId: membership.organizationId,

      kind: CustomerInternalNoteKind.FOLLOW_UP,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'kind',
        'content',
        'createdByUserId',
        'assignedToUserId',
        'dueAt',
        'completedAt',
        'completedByUserId',
        'createdAt',
        'updatedAt',
      )
      .all();

    const hydrated = [];

    for (const note of notes) {
      const customer = await db.orm.public.Customer.where({
        id: note.customerId,

        organizationId: membership.organizationId,
      })
        .select('id', 'firstName', 'lastName', 'companyName', 'archivedAt')
        .first();

      if (!customer || customer.archivedAt) {
        continue;
      }

      const hydratedNote = await this.hydrateNotePrisma8(note);

      hydrated.push({
        ...hydratedNote,

        customer: {
          ...customer,

          archivedAt: customer.archivedAt
            ? fromPrisma8Timestamp(customer.archivedAt)
            : null,
        },
      });
    }

    /*
     * Preserve Prisma 7 ordering:
     *   dueAt ASC
     *   createdAt DESC
     *
     * PostgreSQL ascending nullable timestamps place NULL last.
     */
    hydrated.sort((a, b) => {
      if (a.dueAt === null && b.dueAt !== null) {
        return 1;
      }

      if (a.dueAt !== null && b.dueAt === null) {
        return -1;
      }

      if (a.dueAt !== null && b.dueAt !== null) {
        const dueDifference = a.dueAt.getTime() - b.dueAt.getTime();

        if (dueDifference !== 0) {
          return dueDifference;
        }
      }

      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return hydrated.slice(0, 250);
  }

  async createForUser(
    clerkUserId: string,
    customerId: string,
    input: CreateCustomerInternalNoteDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const kind = input.kind ?? CustomerInternalNoteKind.NOTE;

    const content = input.content.trim();

    if (!content) {
      throw new BadRequestException('Internal note content is required');
    }

    if (
      kind === CustomerInternalNoteKind.NOTE &&
      (input.assignedToUserId || input.dueAt)
    ) {
      throw new BadRequestException(
        'Only follow-ups can have an assignee or due date',
      );
    }

    const assignedToUserId =
      kind === CustomerInternalNoteKind.FOLLOW_UP
        ? await this.resolveAssignedUser(
            membership.organizationId,
            input.assignedToUserId,
          )
        : null;

    const dueAt =
      kind === CustomerInternalNoteKind.FOLLOW_UP
        ? parseOptionalDate(input.dueAt)
        : null;

    const now = toPrisma8Timestamp();

    const created = await db.orm.public.CustomerInternalNote.create({
      organizationId: membership.organizationId,

      customerId,

      createdByUserId: membership.userId,

      kind,

      content,

      assignedToUserId,

      dueAt: dueAt ? toPrisma8Timestamp(dueAt) : null,

      completedAt: null,

      completedByUserId: null,

      createdAt: now,

      updatedAt: now,
    });

    const note = await this.requireHydratedNoteForCustomerPrisma8(
      membership.organizationId,
      customerId,
      created.id,
    );

    if (
      note.kind === CustomerInternalNoteKind.FOLLOW_UP &&
      note.assignedToUserId
    ) {
      await this.notificationsService.create({
        organizationId: membership.organizationId,

        recipientUserId: note.assignedToUserId,

        actorUserId: membership.userId,

        type: NotificationType.FOLLOW_UP_ASSIGNED,

        title: 'Follow-up assigned',

        message: note.content,

        href: `/customers/${customerId}`,

        customerInternalNoteId: note.id,

        dedupeKey: `follow-up-assigned:${note.id}:${note.assignedToUserId}`,
      });
    }

    return note;
  }

  async updateForUser(
    clerkUserId: string,
    customerId: string,
    noteId: string,
    input: UpdateCustomerInternalNoteDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const existing = await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

    const previousAssignedToUserId = existing.assignedToUserId;

    const kind = input.kind ?? existing.kind;

    const content =
      input.content !== undefined ? input.content.trim() : existing.content;

    if (!content) {
      throw new BadRequestException('Internal note content is required');
    }

    if (kind === CustomerInternalNoteKind.NOTE && existing.completedAt) {
      throw new BadRequestException(
        'A completed follow-up must be reopened before converting it to a note',
      );
    }

    let assignedToUserId = existing.assignedToUserId;

    let dueAt = existing.dueAt;

    if (kind === CustomerInternalNoteKind.NOTE) {
      assignedToUserId = null;

      dueAt = null;
    } else {
      if (input.assignedToUserId !== undefined) {
        assignedToUserId = await this.resolveAssignedUser(
          membership.organizationId,
          input.assignedToUserId,
        );
      }

      if (input.dueAt !== undefined) {
        dueAt = parseOptionalDate(input.dueAt);
      }
    }

    await db.orm.public.CustomerInternalNote.where({
      id: noteId,
    }).update({
      kind,

      content,

      assignedToUserId,

      dueAt: dueAt ? toPrisma8Timestamp(dueAt) : null,

      updatedAt: toPrisma8Timestamp(),
    });

    const note = await this.requireHydratedNoteForCustomerPrisma8(
      membership.organizationId,
      customerId,
      noteId,
    );

    const recipientUserId = note.assignedToUserId;

    const wasAssignedToDifferentUser =
      note.kind === CustomerInternalNoteKind.FOLLOW_UP &&
      recipientUserId !== null &&
      recipientUserId !== previousAssignedToUserId;

    if (wasAssignedToDifferentUser) {
      await this.notificationsService.create({
        organizationId: membership.organizationId,

        recipientUserId,

        actorUserId: membership.userId,

        type: NotificationType.FOLLOW_UP_ASSIGNED,

        title: 'Follow-up assigned',

        message: note.content,

        href: `/customers/${customerId}`,

        customerInternalNoteId: note.id,

        dedupeKey: `follow-up-assigned:${note.id}:${recipientUserId}`,
      });
    }

    return note;
  }

  async deleteForUser(
    clerkUserId: string,
    customerId: string,
    noteId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const note = await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

    await db.orm.public.CustomerInternalNote.where({
      id: note.id,
    }).delete();

    return {
      success: true,
    };
  }

  async completeForUser(
    clerkUserId: string,
    customerId: string,
    noteId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const note = await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

    if (note.kind !== CustomerInternalNoteKind.FOLLOW_UP) {
      throw new BadRequestException('Only follow-ups can be completed');
    }

    if (note.completedAt) {
      return this.requireHydratedNoteForCustomerPrisma8(
        membership.organizationId,
        customerId,
        note.id,
      );
    }

    await db.orm.public.CustomerInternalNote.where({
      id: note.id,
    }).update({
      completedAt: toPrisma8Timestamp(),

      completedByUserId: membership.userId,

      updatedAt: toPrisma8Timestamp(),
    });

    const completedNote = await this.requireHydratedNoteForCustomerPrisma8(
      membership.organizationId,
      customerId,
      note.id,
    );

    if (completedNote.assignedToUserId) {
      await this.notificationsService.create({
        organizationId: membership.organizationId,

        recipientUserId: completedNote.assignedToUserId,

        actorUserId: membership.userId,

        type: NotificationType.FOLLOW_UP_COMPLETED,

        title: 'Follow-up completed',

        message: completedNote.content,

        href: `/customers/${customerId}`,

        customerInternalNoteId: completedNote.id,

        dedupeKey: `follow-up-completed:${completedNote.id}`,
      });
    }

    return completedNote;
  }

  async reopenForUser(
    clerkUserId: string,
    customerId: string,
    noteId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const note = await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

    if (note.kind !== CustomerInternalNoteKind.FOLLOW_UP) {
      throw new BadRequestException('Only follow-ups can be reopened');
    }

    if (!note.completedAt) {
      return this.requireHydratedNoteForCustomerPrisma8(
        membership.organizationId,
        customerId,
        note.id,
      );
    }

    await db.orm.public.CustomerInternalNote.where({
      id: note.id,
    }).update({
      completedAt: null,

      completedByUserId: null,

      updatedAt: toPrisma8Timestamp(),
    });

    return this.requireHydratedNoteForCustomerPrisma8(
      membership.organizationId,
      customerId,
      note.id,
    );
  }

  private async resolveAssignedUser(
    organizationId: string,
    assignedToUserId?: string | null,
  ) {
    const normalized = assignedToUserId?.trim();

    if (!normalized) {
      return null;
    }

    const membership = await db.orm.public.Membership.where({
      organizationId,

      userId: normalized,
    })
      .select('userId')
      .first();

    if (!membership) {
      throw new BadRequestException(
        'Assigned user does not belong to this organization',
      );
    }

    return membership.userId;
  }

  private async requireCustomerForOrganization(
    organizationId: string,
    customerId: string,
  ) {
    const customer = await db.orm.public.Customer.where({
      id: customerId,

      organizationId,
    })
      .select('id')
      .first();

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireHydratedNoteForCustomerPrisma8(
    organizationId: string,
    customerId: string,
    noteId: string,
  ) {
    const note = await db.orm.public.CustomerInternalNote.where({
      id: noteId,

      organizationId,

      customerId,
    })
      .select(
        'id',
        'organizationId',
        'customerId',
        'kind',
        'content',
        'createdByUserId',
        'assignedToUserId',
        'dueAt',
        'completedAt',
        'completedByUserId',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!note) {
      throw new NotFoundException('Customer internal note not found');
    }

    return this.hydrateNotePrisma8(note);
  }

  private async requireNoteForCustomer(
    organizationId: string,
    customerId: string,
    noteId: string,
  ) {
    const note = await db.orm.public.CustomerInternalNote.where({
      id: noteId,

      organizationId,

      customerId,
    })
      .select(
        'id',
        'kind',
        'content',
        'assignedToUserId',
        'dueAt',
        'completedAt',
      )
      .first();

    if (!note) {
      throw new NotFoundException('Customer internal note not found');
    }

    return {
      ...note,

      dueAt: note.dueAt ? fromPrisma8Timestamp(note.dueAt) : null,

      completedAt: note.completedAt
        ? fromPrisma8Timestamp(note.completedAt)
        : null,
    };
  }

  private async hydrateNotePrisma8(note: {
    id: string;
    organizationId: string;
    customerId: string;
    kind: CustomerInternalNoteKind;
    content: string;
    createdByUserId: string | null;
    assignedToUserId: string | null;
    dueAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;
    completedAt: Parameters<typeof fromPrisma8Timestamp>[0] | null;
    completedByUserId: string | null;
    createdAt: Parameters<typeof fromPrisma8Timestamp>[0];
    updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
  }) {
    const createdBy = note.createdByUserId
      ? await this.findNoteUserPrisma8(note.createdByUserId)
      : null;

    const assignedTo = note.assignedToUserId
      ? await this.findNoteUserPrisma8(note.assignedToUserId)
      : null;

    const completedBy = note.completedByUserId
      ? await this.findNoteUserPrisma8(note.completedByUserId)
      : null;

    return {
      ...note,

      dueAt: note.dueAt ? fromPrisma8Timestamp(note.dueAt) : null,

      completedAt: note.completedAt
        ? fromPrisma8Timestamp(note.completedAt)
        : null,

      createdAt: fromPrisma8Timestamp(note.createdAt),

      updatedAt: fromPrisma8Timestamp(note.updatedAt),

      createdBy,

      assignedTo,

      completedBy,
    };
  }

  private async findNoteUserPrisma8(userId: string) {
    return db.orm.public.User.where({
      id: userId,
    })
      .select('id', 'firstName', 'lastName', 'email')
      .first();
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }
}

function parseOptionalDate(value?: string | null): Date | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Due date is invalid');
  }

  return date;
}
