import { Injectable, NotFoundException } from '@nestjs/common';
import {
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateCrewMemberDto } from './dto/create-crew-member.dto';
import type { UpdateCrewMemberDto } from './dto/update-crew-member.dto';

type OrmSource = typeof db.orm;

type CrewMemberRecord = {
  id: string;
  organizationId: string;

  firstName: string;
  lastName: string | null;

  email: string | null;
  phone: string | null;

  hourlyCostCents: number;
  currency: string;

  dailyCapacityMinutes: number | null;

  active: boolean;

  createdAt: Parameters<typeof fromPrisma8Timestamp>[0];

  updatedAt: Parameters<typeof fromPrisma8Timestamp>[0];
};

@Injectable()
export class CrewService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async listForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const crewMembers = await db.orm.public.CrewMember.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'organizationId',
        'firstName',
        'lastName',
        'email',
        'phone',
        'hourlyCostCents',
        'currency',
        'dailyCapacityMinutes',
        'active',
        'createdAt',
        'updatedAt',
      )
      .all();

    crewMembers.sort((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }

      const firstName = a.firstName.localeCompare(b.firstName);

      if (firstName !== 0) {
        return firstName;
      }

      return (a.lastName ?? '').localeCompare(b.lastName ?? '');
    });

    return Promise.all(
      crewMembers.map((crewMember) =>
        this.hydrateCrewMember(db.orm, crewMember),
      ),
    );
  }

  async getForUser(
    clerkUserId: string,
    crewMemberId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const crewMember = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    return this.hydrateCrewMember(db.orm, crewMember);
  }

  async createForUser(
    clerkUserId: string,
    input: CreateCrewMemberDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const organization = await db.orm.public.Organization.where({
      id: membership.organizationId,
    })
      .select('currency')
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const now = toPrisma8Timestamp();

    const crewMember = await db.orm.public.CrewMember.create({
      organizationId: membership.organizationId,

      firstName: input.firstName.trim(),

      lastName: clean(input.lastName) ?? null,

      email: cleanEmail(input.email) ?? null,

      phone: clean(input.phone) ?? null,

      hourlyCostCents: input.hourlyCostCents,

      currency: organization.currency,

      dailyCapacityMinutes: input.dailyCapacityMinutes ?? null,

      active: true,

      createdAt: now,

      updatedAt: now,
    });

    return this.hydrateCrewMember(db.orm, crewMember);
  }

  async updateForUser(
    clerkUserId: string,
    crewMemberId: string,
    input: UpdateCrewMemberDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    await db.orm.public.CrewMember.where({
      id: existing.id,
    }).update({
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
        input.phone !== undefined ? cleanNullable(input.phone) : existing.phone,

      hourlyCostCents:
        input.hourlyCostCents !== undefined
          ? input.hourlyCostCents
          : existing.hourlyCostCents,

      dailyCapacityMinutes:
        input.dailyCapacityMinutes !== undefined
          ? input.dailyCapacityMinutes
          : existing.dailyCapacityMinutes,

      updatedAt: toPrisma8Timestamp(),
    });

    const updated = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      existing.id,
    );

    return this.hydrateCrewMember(db.orm, updated);
  }

  async deactivateForUser(
    clerkUserId: string,
    crewMemberId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    if (!existing.active) {
      return this.hydrateCrewMember(db.orm, existing);
    }

    await db.orm.public.CrewMember.where({
      id: existing.id,
    }).update({
      active: false,

      updatedAt: toPrisma8Timestamp(),
    });

    const updated = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      existing.id,
    );

    return this.hydrateCrewMember(db.orm, updated);
  }

  async activateForUser(
    clerkUserId: string,
    crewMemberId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const existing = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      crewMemberId,
    );

    if (existing.active) {
      return this.hydrateCrewMember(db.orm, existing);
    }

    await db.orm.public.CrewMember.where({
      id: existing.id,
    }).update({
      active: true,

      updatedAt: toPrisma8Timestamp(),
    });

    const updated = await this.requireCrewMemberForOrganization(
      membership.organizationId,
      existing.id,
    );

    return this.hydrateCrewMember(db.orm, updated);
  }

  private async requireCrewMemberForOrganization(
    organizationId: string,
    crewMemberId: string,
    orm: OrmSource = db.orm,
  ) {
    const crewMember = await orm.public.CrewMember.where({
      id: crewMemberId,

      organizationId,
    })
      .select(
        'id',
        'organizationId',
        'firstName',
        'lastName',
        'email',
        'phone',
        'hourlyCostCents',
        'currency',
        'dailyCapacityMinutes',
        'active',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!crewMember) {
      throw new NotFoundException('Crew member not found');
    }

    return crewMember;
  }

  private getMembership(clerkUserId: string, activeOrganizationId?: string) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async hydrateCrewMember(
    orm: OrmSource,
    crewMember: CrewMemberRecord,
  ) {
    const [timeEntries, scheduleAssignments] = await Promise.all([
      orm.public.JobTimeEntry.where({
        crewMemberId: crewMember.id,
      })
        .select('id')
        .all(),

      orm.public.JobScheduleCrewMember.where({
        crewMemberId: crewMember.id,
      })
        .select('id')
        .all(),
    ]);

    return {
      id: crewMember.id,

      organizationId: crewMember.organizationId,

      firstName: crewMember.firstName,

      lastName: crewMember.lastName,

      email: crewMember.email,

      phone: crewMember.phone,

      hourlyCostCents: crewMember.hourlyCostCents,

      currency: crewMember.currency,

      dailyCapacityMinutes: crewMember.dailyCapacityMinutes,

      active: crewMember.active,

      createdAt: fromPrisma8Timestamp(crewMember.createdAt),

      updatedAt: fromPrisma8Timestamp(crewMember.updatedAt),

      _count: {
        timeEntries: timeEntries.length,

        scheduleAssignments: scheduleAssignments.length,
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
