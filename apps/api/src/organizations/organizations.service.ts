import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JobScheduleType, OrganizationRole } from '@contractflow/db';
import {
  db,
  fromPrisma8Timestamp,
  isPrisma8UniqueViolation,
  setPrisma8Serializable,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

import { OrganizationMembershipService } from '../auth/organization-membership.service';

import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateDispatchSettingsDto } from './dto/update-dispatch-settings.dto';
import type { UpdateEstimateReminderSettingsDto } from './dto/update-estimate-reminder-settings.dto';
import type { UpdateInvoiceReminderSettingsDto } from './dto/update-invoice-reminder-settings.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import { createOrganizationSlug } from './organization-slug';

const DEFAULT_INVOICE_REMINDER_SETTINGS = {
  enabled: true,

  beforeDueEnabled: true,
  beforeDueDays: 3,

  dueTodayEnabled: true,

  firstOverdueEnabled: true,
  firstOverdueDays: 3,

  secondOverdueEnabled: true,
  secondOverdueDays: 7,
};

const DEFAULT_ESTIMATE_REMINDER_SETTINGS = {
  enabled: true,

  firstFollowUpEnabled: true,
  firstFollowUpDays: 3,

  secondFollowUpEnabled: true,
  secondFollowUpDays: 7,
};

const DEFAULT_DISPATCH_SETTINGS = {
  defaultStartHour: 9,
  defaultStartMinute: 0,
  defaultDurationMinutes: 60,
  defaultScheduleType: JobScheduleType.WORK,
  defaultCrewDailyCapacityMinutes: 480,
};

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly organizationMemberships: OrganizationMembershipService,
  ) {}

  async createForOwner(clerkUserId: string, input: CreateOrganizationDto) {
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (!user) {
      throw new NotFoundException(
        'Authenticated user has not been synchronized',
      );
    }

    const existingMembership = await db.orm.public.Membership.where({
      userId: user.id,
    })
      .select('id')
      .first();

    if (existingMembership) {
      throw new ConflictException('User already belongs to an organization');
    }

    const slug = await this.generateUniqueSlug(input.name);

    try {
      const created = await db.transaction(async (tx) => {
        await setPrisma8Serializable(tx);

        /*
         * Re-check membership inside the transaction so two
         * concurrent organization-creation requests cannot both
         * assign this user to different organizations.
         */
        const membershipInTransaction = await tx.orm.public.Membership.where({
          userId: user.id,
        })
          .select('id')
          .first();

        if (membershipInTransaction) {
          throw new ConflictException(
            'User already belongs to an organization',
          );
        }

        const now = toPrisma8Timestamp();

        const organization = await tx.orm.public.Organization.create({
          name: input.name.trim(),

          slug,

          legalName: cleanOptionalValue(input.legalName) ?? null,

          email: cleanOptionalValue(input.email)?.toLowerCase() ?? null,

          phone: cleanOptionalValue(input.phone) ?? null,

          addressLine1: cleanOptionalValue(input.addressLine1) ?? null,

          addressLine2: cleanOptionalValue(input.addressLine2) ?? null,

          city: cleanOptionalValue(input.city) ?? null,

          province: cleanOptionalValue(input.province) ?? null,

          postalCode: cleanOptionalValue(input.postalCode) ?? null,

          country: cleanOptionalValue(input.country)?.toUpperCase() ?? 'CA',

          taxNumber: cleanOptionalValue(input.taxNumber) ?? null,

          website: cleanOptionalValue(input.website) ?? null,

          logoUrl: cleanOptionalValue(input.logoUrl) ?? null,

          timezone: input.timezone?.trim() ?? 'America/Edmonton',

          currency: input.currency ?? 'CAD',

          createdAt: now,

          updatedAt: now,
        });

        const membership = await tx.orm.public.Membership.create({
          userId: user.id,

          organizationId: organization.id,

          role: OrganizationRole.OWNER,

          createdAt: now,

          updatedAt: now,
        });

        return {
          organization,
          membership,
        };
      });

      const organization = await this.requireOrganizationPrisma8(
        created.organization.id,
      );

      return {
        ...organization,

        memberships: [
          {
            id: created.membership.id,

            role: created.membership.role,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (isPrisma8UniqueViolation(error)) {
        throw new ConflictException(
          'An organization with this identifier already exists',
        );
      }

      throw error;
    }
  }

  async getForUser(clerkUserId: string) {
    const user = await db.orm.public.User.where({
      clerkUserId,
    })
      .select('id')
      .first();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const memberships = await db.orm.public.Membership.where({
      userId: user.id,
    })
      .select('id', 'role', 'organizationId', 'createdAt')
      .orderBy((model) => model.createdAt.asc())
      .all();

    const result = [];

    for (const membership of memberships) {
      const organization = await this.requireOrganizationPrisma8(
        membership.organizationId,
      );

      result.push({
        id: membership.id,

        role: membership.role,

        organization,
      });
    }

    return result;
  }

  async getCurrentForUser(clerkUserId: string, activeOrganizationId?: string) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const organization = await this.requireOrganizationPrisma8(
      membership.organizationId,
    );

    return {
      ...organization,

      role: membership.role,
    };
  }

  async getInvoiceReminderSettingsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const settings = await db.orm.public.InvoiceReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'enabled',
        'beforeDueEnabled',
        'beforeDueDays',
        'dueTodayEnabled',
        'firstOverdueEnabled',
        'firstOverdueDays',
        'secondOverdueEnabled',
        'secondOverdueDays',
        'createdAt',
        'updatedAt',
      )
      .first();

    return {
      ...(settings
        ? {
            ...settings,

            createdAt: fromPrisma8Timestamp(settings.createdAt),

            updatedAt: fromPrisma8Timestamp(settings.updatedAt),
          }
        : {
            ...DEFAULT_INVOICE_REMINDER_SETTINGS,

            createdAt: null,

            updatedAt: null,
          }),

      role: membership.role,
    };
  }

  async updateInvoiceReminderSettingsForUser(
    clerkUserId: string,
    input: UpdateInvoiceReminderSettingsDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    if (
      membership.role !== OrganizationRole.OWNER &&
      membership.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only organization owners and administrators can update invoice reminder settings',
      );
    }

    const existing = await db.orm.public.InvoiceReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'enabled',
        'beforeDueEnabled',
        'beforeDueDays',
        'dueTodayEnabled',
        'firstOverdueEnabled',
        'firstOverdueDays',
        'secondOverdueEnabled',
        'secondOverdueDays',
      )
      .first();

    const current = existing ?? DEFAULT_INVOICE_REMINDER_SETTINGS;

    const next = {
      enabled: input.enabled ?? current.enabled,

      beforeDueEnabled: input.beforeDueEnabled ?? current.beforeDueEnabled,

      beforeDueDays: input.beforeDueDays ?? current.beforeDueDays,

      dueTodayEnabled: input.dueTodayEnabled ?? current.dueTodayEnabled,

      firstOverdueEnabled:
        input.firstOverdueEnabled ?? current.firstOverdueEnabled,

      firstOverdueDays: input.firstOverdueDays ?? current.firstOverdueDays,

      secondOverdueEnabled:
        input.secondOverdueEnabled ?? current.secondOverdueEnabled,

      secondOverdueDays: input.secondOverdueDays ?? current.secondOverdueDays,
    };

    if (
      next.firstOverdueEnabled &&
      next.secondOverdueEnabled &&
      next.secondOverdueDays <= next.firstOverdueDays
    ) {
      throw new BadRequestException(
        'Second overdue reminder must occur after the first overdue reminder',
      );
    }

    const updateExisting = async (id: string) => {
      await db.orm.public.InvoiceReminderSettings.where({
        id,
      }).update({
        ...next,

        updatedAt: toPrisma8Timestamp(),
      });
    };

    if (existing) {
      await updateExisting(existing.id);
    } else {
      const now = toPrisma8Timestamp();

      try {
        await db.orm.public.InvoiceReminderSettings.create({
          organizationId: membership.organizationId,

          ...next,

          createdAt: now,

          updatedAt: now,
        });
      } catch (error) {
        /*
         * Preserve upsert race safety:
         * another request may have inserted this organization's
         * settings after our initial read.
         *
         * Do not query inside a failed PostgreSQL transaction.
         * This create is a standalone operation, so a fresh read
         * after the unique violation is safe.
         */
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }

        const concurrent = await db.orm.public.InvoiceReminderSettings.where({
          organizationId: membership.organizationId,
        })
          .select('id')
          .first();

        if (!concurrent) {
          throw error;
        }

        await updateExisting(concurrent.id);
      }
    }

    const settings = await db.orm.public.InvoiceReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'enabled',
        'beforeDueEnabled',
        'beforeDueDays',
        'dueTodayEnabled',
        'firstOverdueEnabled',
        'firstOverdueDays',
        'secondOverdueEnabled',
        'secondOverdueDays',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!settings) {
      throw new NotFoundException(
        'Invoice reminder settings not found after update',
      );
    }

    return {
      ...settings,

      createdAt: fromPrisma8Timestamp(settings.createdAt),

      updatedAt: fromPrisma8Timestamp(settings.updatedAt),

      role: membership.role,
    };
  }

  async getEstimateReminderSettingsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    const settings = await db.orm.public.EstimateReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'enabled',
        'firstFollowUpEnabled',
        'firstFollowUpDays',
        'secondFollowUpEnabled',
        'secondFollowUpDays',
        'createdAt',
        'updatedAt',
      )
      .first();

    return {
      ...(settings
        ? {
            ...settings,

            createdAt: fromPrisma8Timestamp(settings.createdAt),

            updatedAt: fromPrisma8Timestamp(settings.updatedAt),
          }
        : {
            ...DEFAULT_ESTIMATE_REMINDER_SETTINGS,

            createdAt: null,

            updatedAt: null,
          }),

      role: membership.role,
    };
  }

  async updateEstimateReminderSettingsForUser(
    clerkUserId: string,
    input: UpdateEstimateReminderSettingsDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    if (
      membership.role !== OrganizationRole.OWNER &&
      membership.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only organization owners and administrators can update estimate reminder settings',
      );
    }

    const existing = await db.orm.public.EstimateReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'enabled',
        'firstFollowUpEnabled',
        'firstFollowUpDays',
        'secondFollowUpEnabled',
        'secondFollowUpDays',
      )
      .first();

    const current = existing ?? DEFAULT_ESTIMATE_REMINDER_SETTINGS;

    const next = {
      enabled: input.enabled ?? current.enabled,

      firstFollowUpEnabled:
        input.firstFollowUpEnabled ?? current.firstFollowUpEnabled,

      firstFollowUpDays: input.firstFollowUpDays ?? current.firstFollowUpDays,

      secondFollowUpEnabled:
        input.secondFollowUpEnabled ?? current.secondFollowUpEnabled,

      secondFollowUpDays:
        input.secondFollowUpDays ?? current.secondFollowUpDays,
    };

    if (
      next.firstFollowUpEnabled &&
      next.secondFollowUpEnabled &&
      next.secondFollowUpDays <= next.firstFollowUpDays
    ) {
      throw new BadRequestException(
        'Second estimate follow-up must occur after the first estimate follow-up',
      );
    }

    const updateExisting = async (id: string) => {
      await db.orm.public.EstimateReminderSettings.where({
        id,
      }).update({
        ...next,

        updatedAt: toPrisma8Timestamp(),
      });
    };

    if (existing) {
      await updateExisting(existing.id);
    } else {
      const now = toPrisma8Timestamp();

      try {
        await db.orm.public.EstimateReminderSettings.create({
          organizationId: membership.organizationId,

          ...next,

          createdAt: now,

          updatedAt: now,
        });
      } catch (error) {
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }

        const concurrent = await db.orm.public.EstimateReminderSettings.where({
          organizationId: membership.organizationId,
        })
          .select('id')
          .first();

        if (!concurrent) {
          throw error;
        }

        await updateExisting(concurrent.id);
      }
    }

    const settings = await db.orm.public.EstimateReminderSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'enabled',
        'firstFollowUpEnabled',
        'firstFollowUpDays',
        'secondFollowUpEnabled',
        'secondFollowUpDays',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!settings) {
      throw new NotFoundException(
        'Estimate reminder settings not found after update',
      );
    }

    return {
      ...settings,

      createdAt: fromPrisma8Timestamp(settings.createdAt),

      updatedAt: fromPrisma8Timestamp(settings.updatedAt),

      role: membership.role,
    };
  }

  async getDispatchSettingsForUser(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    let settings = await db.orm.public.DispatchSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'defaultStartHour',
        'defaultStartMinute',
        'defaultDurationMinutes',
        'defaultScheduleType',
        'defaultCrewDailyCapacityMinutes',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!settings) {
      const now = toPrisma8Timestamp();

      try {
        await db.orm.public.DispatchSettings.create({
          organizationId: membership.organizationId,

          ...DEFAULT_DISPATCH_SETTINGS,

          createdAt: now,

          updatedAt: now,
        });
      } catch (error) {
        /*
         * Another request may have created the settings after
         * our initial read. Preserve the old upsert race safety.
         */
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }
      }

      settings = await db.orm.public.DispatchSettings.where({
        organizationId: membership.organizationId,
      })
        .select(
          'defaultStartHour',
          'defaultStartMinute',
          'defaultDurationMinutes',
          'defaultScheduleType',
          'defaultCrewDailyCapacityMinutes',
          'createdAt',
          'updatedAt',
        )
        .first();
    }

    if (!settings) {
      throw new NotFoundException(
        'Dispatch settings not found after initialization',
      );
    }

    return {
      ...settings,

      createdAt: fromPrisma8Timestamp(settings.createdAt),

      updatedAt: fromPrisma8Timestamp(settings.updatedAt),

      role: membership.role,
    };
  }

  async updateDispatchSettingsForUser(
    clerkUserId: string,
    input: UpdateDispatchSettingsDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    if (
      membership.role !== OrganizationRole.OWNER &&
      membership.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only organization owners and administrators can update dispatch settings',
      );
    }

    const existing = await db.orm.public.DispatchSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'id',
        'defaultStartHour',
        'defaultStartMinute',
        'defaultDurationMinutes',
        'defaultScheduleType',
        'defaultCrewDailyCapacityMinutes',
      )
      .first();

    const current = existing ?? DEFAULT_DISPATCH_SETTINGS;

    const next = {
      defaultStartHour: input.defaultStartHour ?? current.defaultStartHour,

      defaultStartMinute:
        input.defaultStartMinute ?? current.defaultStartMinute,

      defaultDurationMinutes:
        input.defaultDurationMinutes ?? current.defaultDurationMinutes,

      defaultScheduleType:
        input.defaultScheduleType ?? current.defaultScheduleType,

      defaultCrewDailyCapacityMinutes:
        input.defaultCrewDailyCapacityMinutes ??
        current.defaultCrewDailyCapacityMinutes,
    };

    const updateExisting = async (id: string) => {
      await db.orm.public.DispatchSettings.where({
        id,
      }).update({
        ...next,

        updatedAt: toPrisma8Timestamp(),
      });
    };

    if (existing) {
      await updateExisting(existing.id);
    } else {
      const now = toPrisma8Timestamp();

      try {
        await db.orm.public.DispatchSettings.create({
          organizationId: membership.organizationId,

          ...next,

          createdAt: now,

          updatedAt: now,
        });
      } catch (error) {
        if (!isPrisma8UniqueViolation(error)) {
          throw error;
        }

        const concurrent = await db.orm.public.DispatchSettings.where({
          organizationId: membership.organizationId,
        })
          .select('id')
          .first();

        if (!concurrent) {
          throw error;
        }

        await updateExisting(concurrent.id);
      }
    }

    const settings = await db.orm.public.DispatchSettings.where({
      organizationId: membership.organizationId,
    })
      .select(
        'defaultStartHour',
        'defaultStartMinute',
        'defaultDurationMinutes',
        'defaultScheduleType',
        'defaultCrewDailyCapacityMinutes',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!settings) {
      throw new NotFoundException('Dispatch settings not found after update');
    }

    return {
      ...settings,

      createdAt: fromPrisma8Timestamp(settings.createdAt),

      updatedAt: fromPrisma8Timestamp(settings.updatedAt),

      role: membership.role,
    };
  }

  async updateCurrentForUser(
    clerkUserId: string,
    input: UpdateOrganizationDto,
    activeOrganizationId?: string,
  ) {
    const membership = await this.getCurrentMembership(
      clerkUserId,
      activeOrganizationId,
    );

    if (
      membership.role !== OrganizationRole.OWNER &&
      membership.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only organization owners and administrators can update the business profile',
      );
    }

    const existing = await db.orm.public.Organization.where({
      id: membership.organizationId,
    })
      .select(
        'id',
        'name',
        'legalName',
        'email',
        'phone',
        'addressLine1',
        'addressLine2',
        'city',
        'province',
        'postalCode',
        'country',
        'taxNumber',
        'website',
        'logoUrl',
        'timezone',
        'currency',
      )
      .first();

    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    await db.orm.public.Organization.where({
      id: existing.id,
    }).update({
      name: input.name !== undefined ? input.name.trim() : existing.name,

      legalName:
        input.legalName !== undefined
          ? cleanNullableValue(input.legalName)
          : existing.legalName,

      email:
        input.email !== undefined
          ? (cleanNullableValue(input.email)?.toLowerCase() ?? null)
          : existing.email,

      phone:
        input.phone !== undefined
          ? cleanNullableValue(input.phone)
          : existing.phone,

      addressLine1:
        input.addressLine1 !== undefined
          ? cleanNullableValue(input.addressLine1)
          : existing.addressLine1,

      addressLine2:
        input.addressLine2 !== undefined
          ? cleanNullableValue(input.addressLine2)
          : existing.addressLine2,

      city:
        input.city !== undefined
          ? cleanNullableValue(input.city)
          : existing.city,

      province:
        input.province !== undefined
          ? cleanNullableValue(input.province)
          : existing.province,

      postalCode:
        input.postalCode !== undefined
          ? cleanNullableValue(input.postalCode)
          : existing.postalCode,

      country:
        input.country !== undefined
          ? input.country.trim().toUpperCase()
          : existing.country,

      taxNumber:
        input.taxNumber !== undefined
          ? cleanNullableValue(input.taxNumber)
          : existing.taxNumber,

      website:
        input.website !== undefined
          ? cleanNullableValue(input.website)
          : existing.website,

      logoUrl:
        input.logoUrl !== undefined
          ? cleanNullableValue(input.logoUrl)
          : existing.logoUrl,

      timezone:
        input.timezone !== undefined
          ? input.timezone.trim()
          : existing.timezone,

      currency:
        input.currency !== undefined ? input.currency : existing.currency,

      updatedAt: toPrisma8Timestamp(),
    });

    return this.requireOrganizationPrisma8(membership.organizationId);
  }

  private getCurrentMembership(
    clerkUserId: string,
    activeOrganizationId?: string,
  ) {
    return this.organizationMemberships.resolveForUser(
      clerkUserId,
      activeOrganizationId,
    );
  }

  private async requireOrganizationPrisma8(organizationId: string) {
    const organization = await db.orm.public.Organization.where({
      id: organizationId,
    })
      .select(
        'id',
        'name',
        'slug',
        'legalName',
        'email',
        'phone',
        'addressLine1',
        'addressLine2',
        'city',
        'province',
        'postalCode',
        'country',
        'taxNumber',
        'website',
        'logoUrl',
        'timezone',
        'currency',
        'createdAt',
        'updatedAt',
      )
      .first();

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      ...organization,

      createdAt: fromPrisma8Timestamp(organization.createdAt),

      updatedAt: fromPrisma8Timestamp(organization.updatedAt),
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = createOrganizationSlug(name);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      const existing = await db.orm.public.Organization.where({
        slug,
      })
        .select('id')
        .first();

      if (!existing) {
        return slug;
      }
    }

    return `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
  }
}

function cleanOptionalValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim();

  return cleaned || undefined;
}

function cleanNullableValue(
  value: string | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const cleaned = value.trim();

  return cleaned || null;
}
