import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { OrganizationRole } from '@contractflow/db';

const mockCreateInvitation = jest.fn();
const mockRevokeInvitation = jest.fn();
const mockIsUniqueViolation = jest.fn();

function makeQuery() {
  const query = {
    where: jest.fn(),
    select: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
    all: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  query.where.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);

  return query;
}

const userQuery = makeQuery();
const membershipQuery = makeQuery();
const invitationQuery = makeQuery();

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    invitations: {
      createInvitation: mockCreateInvitation,
      revokeInvitation: mockRevokeInvitation,
    },
  })),
}));

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    orm: {
      public: {
        User: userQuery,
        Membership: membershipQuery,
        TeamInvitation: invitationQuery,
      },
    },
  },

  fromPrisma8Timestamp: (value: Date) => value,

  toPrisma8Timestamp: (value?: Date) => value ?? new Date(),

  isPrisma8UniqueViolation: (error: unknown) =>
    mockIsUniqueViolation(error) === true,
}));

import type { OrganizationMembershipService } from '../auth/organization-membership.service';
import { TeamMembersService } from './team-members.service';

function createMembershipService(
  role: OrganizationRole = OrganizationRole.OWNER,
): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn().mockResolvedValue({
      id: 'actor_membership',
      userId: 'actor_user',
      organizationId: 'org_1',
      role,
    }),
  };
}

function createConfigService() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'WEB_URL') {
        return 'https://app.contractflow.test';
      }

      if (key === 'CLERK_SECRET_KEY') {
        return 'sk_test_contractflow';
      }

      return undefined;
    }),
  };
}

function createService(
  role: OrganizationRole = OrganizationRole.OWNER,
): TeamMembersService {
  return new TeamMembersService(
    createMembershipService(role),
    createConfigService() as never,
  );
}

describe('TeamMembersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userQuery.where.mockReturnValue(userQuery);
    userQuery.select.mockReturnValue(userQuery);

    membershipQuery.where.mockReturnValue(membershipQuery);
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.orderBy.mockReturnValue(membershipQuery);

    invitationQuery.where.mockReturnValue(invitationQuery);
    invitationQuery.select.mockReturnValue(invitationQuery);

    userQuery.first.mockResolvedValue(null);

    membershipQuery.first.mockResolvedValue(null);
    membershipQuery.all.mockResolvedValue([]);
    membershipQuery.create.mockResolvedValue({
      id: 'membership_new',
      role: OrganizationRole.MANAGER,
    });
    membershipQuery.update.mockResolvedValue(undefined);
    membershipQuery.delete.mockResolvedValue(undefined);

    invitationQuery.first.mockResolvedValue(null);
    invitationQuery.all.mockResolvedValue([]);
    invitationQuery.create.mockResolvedValue({
      id: 'invite_local_1',
      role: OrganizationRole.MANAGER,
    });
    invitationQuery.update.mockResolvedValue(undefined);

    mockCreateInvitation.mockResolvedValue({
      id: 'clerk_invite_1',
    });

    mockRevokeInvitation.mockResolvedValue({
      id: 'clerk_invite_1',
    });

    mockIsUniqueViolation.mockReturnValue(false);
  });

  it('attaches an existing synchronized user directly without Clerk invitation', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_existing',
      email: 'member@example.com',
    });

    membershipQuery.first.mockResolvedValue(null);

    membershipQuery.create.mockResolvedValue({
      id: 'membership_existing_user',
      role: OrganizationRole.MANAGER,
    });

    const service = createService();

    await expect(
      service.inviteForUser(
        'clerk_actor',
        ' Member@Example.com ',
        OrganizationRole.MANAGER,
        'org_1',
      ),
    ).resolves.toEqual({
      kind: 'MEMBERSHIP',
      membershipId: 'membership_existing_user',
      email: 'member@example.com',
      role: OrganizationRole.MANAGER,
    });

    expect(userQuery.where).toHaveBeenCalledWith({
      email: 'member@example.com',
    });

    expect(membershipQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_existing',
        organizationId: 'org_1',
        role: OrganizationRole.MANAGER,
      }),
    );

    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('rejects an existing user who is already a member', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_existing',
      email: 'member@example.com',
    });

    membershipQuery.first.mockResolvedValue({
      id: 'membership_existing',
    });

    const service = createService();

    await expect(
      service.inviteForUser(
        'clerk_actor',
        'member@example.com',
        OrganizationRole.VIEWER,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(membershipQuery.create).not.toHaveBeenCalled();
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('creates a Clerk invitation and local pending invitation for a new user', async () => {
    userQuery.first.mockResolvedValue(null);
    invitationQuery.all.mockResolvedValue([]);

    invitationQuery.create.mockResolvedValue({
      id: 'invite_local_1',
      role: OrganizationRole.TECHNICIAN,
    });

    const service = createService();

    const result = await service.inviteForUser(
      'clerk_actor',
      ' NEW@Example.com ',
      OrganizationRole.TECHNICIAN,
      'org_1',
    );

    expect(mockCreateInvitation).toHaveBeenCalledWith({
      emailAddress: 'new@example.com',
      expiresInDays: 30,
      ignoreExisting: true,
      notify: true,
      redirectUrl: 'https://app.contractflow.test/onboarding',
    });

    expect(invitationQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        invitedByUserId: 'actor_user',
        email: 'new@example.com',
        role: OrganizationRole.TECHNICIAN,
        clerkInvitationId: 'clerk_invite_1',
        acceptedAt: null,
        revokedAt: null,
      }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: 'INVITATION',
        invitationId: 'invite_local_1',
        email: 'new@example.com',
        role: OrganizationRole.TECHNICIAN,
      }),
    );
  });

  it('rejects a duplicate active pending invitation', async () => {
    userQuery.first.mockResolvedValue(null);

    invitationQuery.all.mockResolvedValue([
      {
        id: 'invite_existing',
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      },
    ]);

    const service = createService();

    await expect(
      service.inviteForUser(
        'clerk_actor',
        'member@example.com',
        OrganizationRole.OFFICE,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockCreateInvitation).not.toHaveBeenCalled();
    expect(invitationQuery.create).not.toHaveBeenCalled();
  });

  it('revokes the Clerk invitation when local invitation persistence fails', async () => {
    userQuery.first.mockResolvedValue(null);
    invitationQuery.all.mockResolvedValue([]);

    invitationQuery.create.mockRejectedValue(new Error('database unavailable'));

    const service = createService();

    await expect(
      service.inviteForUser(
        'clerk_actor',
        'member@example.com',
        OrganizationRole.VIEWER,
        'org_1',
      ),
    ).rejects.toThrow('database unavailable');

    expect(mockCreateInvitation).toHaveBeenCalledTimes(1);
    expect(mockRevokeInvitation).toHaveBeenCalledWith('clerk_invite_1');
  });

  it('does not allow OWNER to be assigned through an invitation', async () => {
    const service = createService();

    await expect(
      service.inviteForUser(
        'clerk_actor',
        'owner@example.com',
        OrganizationRole.OWNER,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(userQuery.first).not.toHaveBeenCalled();
    expect(mockCreateInvitation).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from promoting another member to OWNER', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_target',
      userId: 'user_target',
      role: OrganizationRole.MANAGER,
    });

    const service = createService(OrganizationRole.ADMIN);

    await expect(
      service.updateRoleForUser(
        'clerk_admin',
        'membership_target',
        OrganizationRole.OWNER,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(membershipQuery.update).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from demoting an OWNER', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_owner',
      userId: 'user_owner',
      role: OrganizationRole.OWNER,
    });

    const service = createService(OrganizationRole.ADMIN);

    await expect(
      service.updateRoleForUser(
        'clerk_admin',
        'membership_owner',
        OrganizationRole.ADMIN,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(membershipQuery.update).not.toHaveBeenCalled();
  });

  it('prevents an ADMIN from removing an OWNER', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_owner',
      role: OrganizationRole.OWNER,
    });

    const service = createService(OrganizationRole.ADMIN);

    await expect(
      service.removeForUser('clerk_admin', 'membership_owner', 'org_1'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(membershipQuery.delete).not.toHaveBeenCalled();
  });

  it('prevents demoting the final OWNER', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_owner',
      userId: 'user_owner',
      role: OrganizationRole.OWNER,
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_owner',
        role: OrganizationRole.OWNER,
      },
      {
        id: 'membership_admin',
        role: OrganizationRole.ADMIN,
      },
    ]);

    const service = createService(OrganizationRole.OWNER);

    await expect(
      service.updateRoleForUser(
        'clerk_owner',
        'membership_owner',
        OrganizationRole.ADMIN,
        'org_1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(membershipQuery.update).not.toHaveBeenCalled();
  });

  it('prevents removing the final OWNER', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_owner',
      role: OrganizationRole.OWNER,
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_owner',
        role: OrganizationRole.OWNER,
      },
    ]);

    const service = createService(OrganizationRole.OWNER);

    await expect(
      service.removeForUser('clerk_owner', 'membership_owner', 'org_1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(membershipQuery.delete).not.toHaveBeenCalled();
  });

  it('updates a normal team member role', async () => {
    membershipQuery.first
      .mockResolvedValueOnce({
        id: 'membership_target',
        userId: 'user_target',
        role: OrganizationRole.VIEWER,
      })
      .mockResolvedValueOnce({
        id: 'membership_target',
        userId: 'user_target',
        role: OrganizationRole.MANAGER,
      });

    userQuery.first.mockResolvedValue({
      id: 'user_target',
      email: 'member@example.com',
      firstName: 'Team',
      lastName: 'Member',
      imageUrl: null,
    });

    const service = createService(OrganizationRole.ADMIN);

    await expect(
      service.updateRoleForUser(
        'clerk_admin',
        'membership_target',
        OrganizationRole.MANAGER,
        'org_1',
      ),
    ).resolves.toEqual({
      membershipId: 'membership_target',
      role: OrganizationRole.MANAGER,
      id: 'user_target',
      email: 'member@example.com',
      firstName: 'Team',
      lastName: 'Member',
      imageUrl: null,
    });

    expect(membershipQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        role: OrganizationRole.MANAGER,
      }),
    );
  });

  it('removes a non-owner team member', async () => {
    membershipQuery.first.mockResolvedValue({
      id: 'membership_target',
      role: OrganizationRole.TECHNICIAN,
    });

    const service = createService(OrganizationRole.ADMIN);

    await expect(
      service.removeForUser('clerk_admin', 'membership_target', 'org_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(membershipQuery.delete).toHaveBeenCalledTimes(1);
  });
});
