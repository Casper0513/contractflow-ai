import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationRole, Prisma, prisma } from '@contractflow/db';

import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import { createOrganizationSlug } from './organization-slug';

@Injectable()
export class OrganizationsService {
  async createForOwner(clerkUserId: string, input: CreateOrganizationDto) {
    const user = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },

      select: {
        id: true,

        memberships: {
          select: {
            id: true,
          },

          take: 1,
        },
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Authenticated user has not been synchronized',
      );
    }

    if (user.memberships.length > 0) {
      throw new ConflictException('User already belongs to an organization');
    }

    const slug = await this.generateUniqueSlug(input.name);

    try {
      return await prisma.organization.create({
        data: {
          name: input.name.trim(),

          slug,

          legalName: cleanOptionalValue(input.legalName),

          email: cleanOptionalValue(input.email)?.toLowerCase(),

          phone: cleanOptionalValue(input.phone),

          addressLine1: cleanOptionalValue(input.addressLine1),

          addressLine2: cleanOptionalValue(input.addressLine2),

          city: cleanOptionalValue(input.city),

          province: cleanOptionalValue(input.province),

          postalCode: cleanOptionalValue(input.postalCode),

          country: cleanOptionalValue(input.country)?.toUpperCase() ?? 'CA',

          taxNumber: cleanOptionalValue(input.taxNumber),

          website: cleanOptionalValue(input.website),

          logoUrl: cleanOptionalValue(input.logoUrl),

          timezone: input.timezone?.trim() ?? 'America/Edmonton',

          currency: input.currency ?? 'CAD',

          memberships: {
            create: {
              userId: user.id,
              role: OrganizationRole.OWNER,
            },
          },
        },

        select: {
          id: true,
          name: true,
          slug: true,

          legalName: true,

          email: true,
          phone: true,

          addressLine1: true,
          addressLine2: true,
          city: true,
          province: true,
          postalCode: true,
          country: true,

          taxNumber: true,

          website: true,
          logoUrl: true,

          timezone: true,
          currency: true,

          createdAt: true,
          updatedAt: true,

          memberships: {
            where: {
              userId: user.id,
            },

            select: {
              id: true,
              role: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An organization with this identifier already exists',
        );
      }

      throw error;
    }
  }

  async getForUser(clerkUserId: string) {
    const user = await prisma.user.findUnique({
      where: {
        clerkUserId,
      },

      select: {
        memberships: {
          orderBy: {
            createdAt: 'asc',
          },

          select: {
            id: true,
            role: true,

            organization: {
              select: this.organizationSelect(),
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.memberships;
  }

  async getCurrentForUser(clerkUserId: string) {
    const membership = await this.getCurrentMembership(clerkUserId);

    const organization = await prisma.organization.findUnique({
      where: {
        id: membership.organizationId,
      },

      select: this.organizationSelect(),
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      ...organization,
      role: membership.role,
    };
  }

  async updateCurrentForUser(
    clerkUserId: string,
    input: UpdateOrganizationDto,
  ) {
    const membership = await this.getCurrentMembership(clerkUserId);

    if (
      membership.role !== OrganizationRole.OWNER &&
      membership.role !== OrganizationRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only organization owners and administrators can update the business profile',
      );
    }

    return prisma.organization.update({
      where: {
        id: membership.organizationId,
      },

      data: {
        name: input.name !== undefined ? input.name.trim() : undefined,

        legalName: cleanNullableValue(input.legalName),

        email:
          input.email !== undefined
            ? (cleanNullableValue(input.email)?.toLowerCase() ?? null)
            : undefined,

        phone: cleanNullableValue(input.phone),

        addressLine1: cleanNullableValue(input.addressLine1),

        addressLine2: cleanNullableValue(input.addressLine2),

        city: cleanNullableValue(input.city),

        province: cleanNullableValue(input.province),

        postalCode: cleanNullableValue(input.postalCode),

        country:
          input.country !== undefined
            ? input.country.trim().toUpperCase()
            : undefined,

        taxNumber: cleanNullableValue(input.taxNumber),

        website: cleanNullableValue(input.website),

        logoUrl: cleanNullableValue(input.logoUrl),

        timezone:
          input.timezone !== undefined ? input.timezone.trim() : undefined,

        currency: input.currency,
      },

      select: this.organizationSelect(),
    });
  }

  private async getCurrentMembership(clerkUserId: string) {
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
        id: true,
        userId: true,
        organizationId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('No organization membership found');
    }

    return membership;
  }

  private organizationSelect(): Prisma.OrganizationSelect {
    return {
      id: true,

      name: true,
      slug: true,

      legalName: true,

      email: true,
      phone: true,

      addressLine1: true,
      addressLine2: true,
      city: true,
      province: true,
      postalCode: true,
      country: true,

      taxNumber: true,

      website: true,
      logoUrl: true,

      timezone: true,
      currency: true,

      createdAt: true,
      updatedAt: true,
    };
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = createOrganizationSlug(name);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

      const existing = await prisma.organization.findUnique({
        where: {
          slug,
        },

        select: {
          id: true,
        },
      });

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
