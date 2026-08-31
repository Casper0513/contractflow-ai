import { NotFoundException } from '@nestjs/common';
import { OrganizationRole, prisma } from '@contractflow/db';

import { OrganizationMembershipService } from './organization-membership.service';

describe('OrganizationMembershipService', () => {
  let service: OrganizationMembershipService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new OrganizationMembershipService();
  });

  it('throws when the user has no memberships', async () => {
    jest.spyOn(prisma.membership, 'findMany').mockResolvedValue([] as never);

    await expect(service.resolveForUser('user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the only membership when no organization is explicitly selected', async () => {
    const membership = {
      id: 'membership_1',
      userId: 'user_db_1',
      organizationId: 'org_1',
      role: OrganizationRole.ADMIN,
    };

    jest
      .spyOn(prisma.membership, 'findMany')
      .mockResolvedValue([membership] as never);

    await expect(service.resolveForUser('user_1')).resolves.toEqual(membership);
  });

  it('fails closed when multiple memberships exist without an active organization', async () => {
    jest.spyOn(prisma.membership, 'findMany').mockResolvedValue([
      {
        id: 'membership_1',
        userId: 'user_db_1',
        organizationId: 'org_1',
        role: OrganizationRole.ADMIN,
      },
      {
        id: 'membership_2',
        userId: 'user_db_1',
        organizationId: 'org_2',
        role: OrganizationRole.VIEWER,
      },
    ] as never);

    await expect(service.resolveForUser('user_1')).rejects.toThrow(
      'An active organization must be selected before continuing',
    );
  });

  it('resolves an explicitly selected organization membership', async () => {
    const membership = {
      id: 'membership_2',
      userId: 'user_db_1',
      organizationId: 'org_2',
      role: OrganizationRole.MANAGER,
    };

    const findFirst = jest
      .spyOn(prisma.membership, 'findFirst')
      .mockResolvedValue(membership as never);

    await expect(service.resolveForUser('user_1', 'org_2')).resolves.toEqual(
      membership,
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org_2',
        user: {
          clerkUserId: 'user_1',
        },
      },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
      },
    });
  });

  it('rejects an explicitly selected organization the user does not belong to', async () => {
    jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue(null);

    await expect(
      service.resolveForUser('user_1', 'org_not_allowed'),
    ).rejects.toThrow('You do not belong to the selected organization');
  });

  it('uses deterministic fail-closed discovery when no organization is selected', async () => {
    const findMany = jest
      .spyOn(prisma.membership, 'findMany')
      .mockResolvedValue([] as never);

    await expect(service.resolveForUser('user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(findMany).toHaveBeenCalledWith({
      where: {
        user: {
          clerkUserId: 'user_1',
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 2,
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
      },
    });
  });
});
