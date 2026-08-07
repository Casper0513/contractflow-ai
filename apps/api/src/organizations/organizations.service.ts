import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrganizationRole,
  Prisma,
  prisma,
} from "@contractflow/db";

import type { CreateOrganizationDto } from "./dto/create-organization.dto";
import { createOrganizationSlug } from "./organization-slug";

@Injectable()
export class OrganizationsService {
  async createForOwner(
    clerkUserId: string,
    input: CreateOrganizationDto,
  ) {
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
        "Authenticated user has not been synchronized",
      );
    }

    if (user.memberships.length > 0) {
      throw new ConflictException(
        "User already belongs to an organization",
      );
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
          timezone: input.timezone ?? "America/Edmonton",
          currency: input.currency ?? "CAD",

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
          timezone: true,
          currency: true,
          createdAt: true,
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
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "An organization with this identifier already exists",
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
            createdAt: "asc",
          },
          select: {
            id: true,
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                legalName: true,
                email: true,
                phone: true,
                timezone: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user.memberships;
  }

  private async generateUniqueSlug(name: string): Promise<string> {
    const baseSlug = createOrganizationSlug(name);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug}-${attempt + 1}`;

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

function cleanOptionalValue(
  value: string | undefined,
): string | undefined {
  const cleaned = value?.trim();

  return cleaned ? cleaned : undefined;
}