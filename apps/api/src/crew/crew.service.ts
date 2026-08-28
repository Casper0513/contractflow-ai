import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, prisma } from '@contractflow/db';

import type { CreateCrewMemberDto } from './dto/create-crew-member.dto';
import type { UpdateCrewMemberDto } from './dto/update-crew-member.dto';

@Injectable()
export class CrewService {
  async listForUser(clerkUserId: string) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.crewMember.findMany({
      where: {
        organizationId: membership.organizationId,
      },

      orderBy: [
        {
          active: 'desc',
        },
        {
          firstName: 'asc',
        },
        {
          lastName: 'asc',
        },
      ],

      select: this.crewMemberSelect(),
    });
  }

  async getForUser(clerkUserId: string, crewMemberId: string) {
    const membership = await this.getMembership(clerkUserId);

    return this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );
  }

  async createForUser(clerkUserId: string, input: CreateCrewMemberDto) {
    const membership = await this.getMembership(clerkUserId);

    return prisma.crewMember.create({
      data: {
        organizationId: membership.organizationId,

        firstName: input.firstName.trim(),
        lastName: clean(input.lastName),

        email: cleanEmail(input.email),
        phone: clean(input.phone),

        hourlyCostCents: input.hourlyCostCents,

        dailyCapacityMinutes: input.dailyCapacityMinutes ?? null,

        active: true,
      },

      select: this.crewMemberSelect(),
    });
  }

  async updateForUser(
    clerkUserId: string,
    crewMemberId: string,
    input: UpdateCrewMemberDto,
  ) {
    const membership = await this.getMembership(clerkUserId);

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    return prisma.crewMember.update({
      where: {
        id: existing.id,
      },

      data: {
        firstName:
          input.firstName !== undefined
            ? input.firstName.trim()
            : existing.firstName,

        lastName:
          input.lastName !== undefined
            ? cleanNullable(input.lastName)
            : existing.lastName,

        email:
          input.email !== undefined
            ? cleanEmailNullable(input.email)
            : existing.email,

        phone:
          input.phone !== undefined
            ? cleanNullable(input.phone)
            : existing.phone,

        hourlyCostCents:
          input.hourlyCostCents !== undefined
            ? input.hourlyCostCents
            : existing.hourlyCostCents,

        dailyCapacityMinutes:
          input.dailyCapacityMinutes !== undefined
            ? input.dailyCapacityMinutes
            : existing.dailyCapacityMinutes,
      },

      select: this.crewMemberSelect(),
    });
  }

  async deactivateForUser(clerkUserId: string, crewMemberId: string) {
    const membership = await this.getMembership(clerkUserId);

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    if (!existing.active) {
      return existing;
    }

    return prisma.crewMember.update({
      where: {
        id: existing.id,
      },

      data: {
        active: false,
      },

      select: this.crewMemberSelect(),
    });
  }

  async activateForUser(clerkUserId: string, crewMemberId: string) {
    const membership = await this.getMembership(clerkUserId);

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    if (existing.active) {
      return existing;
    }

    return prisma.crewMember.update({
      where: {
        id: existing.id,
      },

      data: {
        active: true,
      },

      select: this.crewMemberSelect(),
    });
  }

  private async requireCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
  ) {
    const crewMember = await prisma.crewMember.findFirst({
      where: {
        id: crewMemberId,
        organizationId,
      },

      select: this.crewMemberSelect(),
    });

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    return crewMember;
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

  private crewMemberSelect(): Prisma.CrewMemberSelect {
    return {
      id: true,
      organizationId: true,

      firstName: true,
      lastName: true,

      email: true,
      phone: true,

      hourlyCostCents: true,
      dailyCapacityMinutes: true,

      active: true,

      createdAt: true,
      updatedAt: true,

      _count: {
        select: {
          timeEntries: true,
          scheduleAssignments: true,
        },
      },
    };
  }
}

function clean(value: string | undefined): string | undefined {
  const result = value?.trim();

  return result || undefined;
}

function cleanNullable(value: string | null | undefined): string | null {
  const result = value?.trim();

  return result || null;
}

function cleanEmail(value: string | undefined): string | undefined {
  const result = value?.trim().toLowerCase();

  return result || undefined;
}

function cleanEmailNullable(value: string | null | undefined): string | null {
  const result = value?.trim().toLowerCase();

  return result || null;
}
