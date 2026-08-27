import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerInternalNoteKind, Prisma, prisma } from '@contractflow/db';

import type { CreateCustomerInternalNoteDto } from './dto/create-customer-internal-note.dto';
import type { UpdateCustomerInternalNoteDto } from './dto/update-customer-internal-note.dto';

@Injectable()
export class CustomerInternalNotesService {
  async listForCustomerForUser(clerkUserId: string, customerId: string) {
    const membership = await this.getMembership(clerkUserId);

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

  async listFollowUpsForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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

    return prisma.customerInternalNote.create({
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
  }

  async updateForUser(
    clerkUserId: string,
    customerId: string,
    noteId: string,
    input: UpdateCustomerInternalNoteDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    await this.requireCustomerForOrganization(
      membership.organizationId,
      customerId,
    );

    const existing = await this.requireNoteForCustomer(
      membership.organizationId,
      customerId,
      noteId,
    );

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

    return prisma.customerInternalNote.update({
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
  }

  async deleteForUser(clerkUserId: string, customerId: string, noteId: string) {
    const membership = await this.getMembership(clerkUserId);

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
  ) {
    const membership = await this.getMembership(clerkUserId);

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

    return prisma.customerInternalNote.update({
      where: {
        id: note.id,
      },

      data: {
        completedAt: new Date(),

        completedByUserId: membership.userId,
      },

      select: this.noteSelect(),
    });
  }

  async reopenForUser(clerkUserId: string, customerId: string, noteId: string) {
    const membership = await this.getMembership(clerkUserId);

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

  private async getMembership(clerkUserId: string) {
    const membership = await prisma.membership.findFirst({
      where: {
        user: {
          clerkUserId,
        },
      },

      orderBy: {
        createdAt: 'asc',
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
