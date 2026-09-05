import { NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

const userFirst = jest.fn();

const membershipFirst = jest.fn();

const membershipAll = jest.fn();

const userQuery = {
  where: jest.fn(),

  select: jest.fn(),

  first: userFirst,
};

const membershipQuery = {
  where: jest.fn(),

  select: jest.fn(),

  orderBy: jest.fn(),

  first: membershipFirst,

  all: membershipAll,
};

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    orm: {
      public: {
        User: userQuery,

        Membership: membershipQuery,
      },
    },
  },
}));

import { OrganizationMembershipService } from './organization-membership.service';

describe('OrganizationMembershipService', () => {
  let service: OrganizationMembershipService;

  beforeEach(() => {
    jest.clearAllMocks();

    userQuery.where.mockReturnValue(userQuery);

    userQuery.select.mockReturnValue(userQuery);

    membershipQuery.where.mockReturnValue(membershipQuery);

    membershipQuery.select.mockReturnValue(membershipQuery);

    membershipQuery.orderBy.mockReturnValue(membershipQuery);

    userFirst.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipFirst.mockResolvedValue(null);

    membershipAll.mockResolvedValue([]);

    service = new OrganizationMembershipService();
  });

  it('throws when the user has no memberships', async () => {
    membershipAll.mockResolvedValue([]);

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

      createdAt: new Date(),
    };

    membershipAll.mockResolvedValue([membership]);

    await expect(service.resolveForUser('user_1')).resolves.toEqual({
      id: 'membership_1',

      userId: 'user_db_1',

      organizationId: 'org_1',

      role: OrganizationRole.ADMIN,
    });
  });

  it('fails closed when multiple memberships exist without an active organization', async () => {
    membershipAll.mockResolvedValue([
      {
        id: 'membership_1',

        userId: 'user_db_1',

        organizationId: 'org_1',

        role: OrganizationRole.ADMIN,

        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 'membership_2',

        userId: 'user_db_1',

        organizationId: 'org_2',

        role: OrganizationRole.VIEWER,

        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);

    await expect(service.resolveForUser('user_1')).rejects.toThrow(
      'An active organization must be selected before continuing',
    );
  });

  it('resolves an explicitly selected organization membership', async () => {
    membershipFirst.mockResolvedValue({
      id: 'membership_2',

      userId: 'user_db_1',

      organizationId: 'org_2',

      role: OrganizationRole.MANAGER,
    });

    await expect(service.resolveForUser('user_1', 'org_2')).resolves.toEqual({
      id: 'membership_2',

      userId: 'user_db_1',

      organizationId: 'org_2',

      role: OrganizationRole.MANAGER,
    });

    expect(membershipQuery.where).toHaveBeenCalledWith({
      organizationId: 'org_2',

      userId: 'user_db_1',
    });
  });

  it('rejects an explicitly selected organization the user does not belong to', async () => {
    membershipFirst.mockResolvedValue(null);

    await expect(
      service.resolveForUser('user_1', 'org_not_allowed'),
    ).rejects.toThrow('You do not belong to the selected organization');
  });

  it('fails closed when the Clerk user has no local ContractFlow user', async () => {
    userFirst.mockResolvedValue(null);

    await expect(service.resolveForUser('user_missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(membershipQuery.where).not.toHaveBeenCalled();
  });

  it('uses deterministic oldest-first discovery when no organization is selected', async () => {
    membershipAll.mockResolvedValue([]);

    await expect(service.resolveForUser('user_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(userQuery.where).toHaveBeenCalledWith({
      clerkUserId: 'user_1',
    });

    expect(membershipQuery.where).toHaveBeenCalledWith({
      userId: 'user_db_1',
    });

    expect(membershipQuery.orderBy).toHaveBeenCalledTimes(1);
  });
});
