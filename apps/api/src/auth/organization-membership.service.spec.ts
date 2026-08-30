import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationRole, prisma } from '@contractflow/db';

import { OrganizationMembershipService } from './organization-membership.service';

describe('OrganizationMembershipService', () => {
  let service: OrganizationMembershipService;

  beforeEach(() => {
    jest.restoreAllMocks();
    service = new OrganizationMembershipService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a user with no organization memberships', async () => {
    jest.spyOn(prisma.membership, 'findMany').mockResolvedValue([]);

    await expect(service.resolveForUser('user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the membership when exactly one organization exists', async () => {
    jest.spyOn(prisma.membership, 'findMany').mockResolvedValue([
      {
        id: 'membership_1',
        userId: 'user_db_1',
        organizationId: 'org_1',
        role: OrganizationRole.MANAGER,
      },
    ] as never);

    await expect(service.resolveForUser('user_1')).resolves.toEqual({
      id: 'membership_1',
      userId: 'user_db_1',
      organizationId: 'org_1',
      role: OrganizationRole.MANAGER,
    });
  });

  it('fails closed when multiple organization memberships exist', async () => {
    jest.spyOn(prisma.membership, 'findMany').mockResolvedValue([
      {
        id: 'membership_1',
        userId: 'user_db_1',
        organizationId: 'org_1',
        role: OrganizationRole.OWNER,
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

    await expect(service.resolveForUser('user_1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('queries only enough memberships to detect ambiguity', async () => {
    const membershipSpy = jest
      .spyOn(prisma.membership, 'findMany')
      .mockResolvedValue([
        {
          id: 'membership_1',
          userId: 'user_db_1',
          organizationId: 'org_1',
          role: OrganizationRole.OWNER,
        },
      ] as never);

    await service.resolveForUser('user_1');

    expect(membershipSpy).toHaveBeenCalledWith({
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
