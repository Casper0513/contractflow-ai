import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerInternalNoteKind,
  NotificationType,
  Prisma,
  prisma,
} from '@contractflow/db';

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

    return prisma.customerInternalNote.findMany({
      where: {
        organizationId: membership.organizationId,
        customerId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      select: this.noteSelect(),
    });
  }

  async listFollowUpsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    return prisma.customerInternalNote.findMany({
      where: {
        organizationId: membership.organizationId,

        kind: CustomerInternalNoteKind.FOLLOW_UP,

        customer: {
          archivedAt: null,
        },
      },

      orderBy: [
        {
          dueAt: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],

      take: 250,

      select: {
        ...this.noteSelect(),

        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            companyName: true,
            archivedAt: true,
          },
        },
      },
    });
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

    const note = await prisma.customerInternalNote.create({
      data: {
        organizationId: membership.organizationId,

        customerId,

        createdByUserId: membership.userId,

        kind,
        content,

        assignedToUserId,

        dueAt,
      },

      select: this.noteSelect(),
    });

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

    const note = await prisma.customerInternalNote.update({
      where: {
        id: noteId,
      },

      data: {
        kind,
        content,
        assignedToUserId,
        dueAt,
      },

      select: this.noteSelect(),
    });

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

    await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

    await prisma.customerInternalNote.delete({
      where: {
        id: noteId,
      },
    });

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
      return prisma.customerInternalNote.findUniqueOrThrow({
        where: {
          id: note.id,
        },

        select: this.noteSelect(),
      });
    }

    const completedNote = await prisma.customerInternalNote.update({
      where: {
        id: note.id,
      },

      data: {
        completedAt: new Date(),
        completedByUserId: membership.userId,
      },

      select: this.noteSelect(),
    });

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
      return prisma.customerInternalNote.findUniqueOrThrow({
        where: {
          id: note.id,
        },

        select: this.noteSelect(),
      });
    }

    return prisma.customerInternalNote.update({
      where: {
        id: note.id,
      },

      data: {
        completedAt: null,
        completedByUserId: null,
      },

      select: this.noteSelect(),
    });
  }

  private async resolveAssignedUser(
    organizationId: string,
    assignedToUserId?: string | null,
  ) {
    const normalized = assignedToUserId?.trim();

    if (!normalized) {
      return null;
    }

    const membership = await prisma.membership.findFirst({
      where: {
        organizationId,
        userId: normalized,
      },

      select: {
        userId: true,
      },
    });

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
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        organizationId,
      },

      select: {
        id: true,
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  private async requireNoteForCustomer(
    organizationId: string,
    customerId: string,
    noteId: string,
  ) {
    const note = await prisma.customerInternalNote.findFirst({
      where: {
        id: noteId,
        organizationId,
        customerId,
      },

      select: {
        id: true,
        kind: true,
        content: true,
        assignedToUserId: true,
        dueAt: true,
        completedAt: true,
      },
    });

    if (!note) {
      throw new NotFoundException('Customer internal note not found');
    }

    return note;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private noteSelect(): Prisma.CustomerInternalNoteSelect {
    return {
      id: true,
      organizationId: true,
      customerId: true,

      kind: true,
      content: true,

      createdByUserId: true,
      assignedToUserId: true,

      dueAt: true,

      completedAt: true,
      completedByUserId: true,

      createdAt: true,
      updatedAt: true,

      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },

      completedBy: {
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
