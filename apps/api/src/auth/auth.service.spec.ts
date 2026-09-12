import { OrganizationRole } from '@contractflow/db';

const mockGetUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockTransaction = jest.fn();
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
const organizationQuery = makeQuery();
const invitationQuery = makeQuery();

const txMembershipQuery = makeQuery();
const txInvitationQuery = makeQuery();

jest.mock('@clerk/backend', () => ({
  createClerkClient: jest.fn(() => ({
    users: {
      getUser: mockGetUser,
      deleteUser: mockDeleteUser,
    },
  })),
}));

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    transaction: mockTransaction,

    orm: {
      public: {
        User: userQuery,
        Membership: membershipQuery,
        Organization: organizationQuery,
        TeamInvitation: invitationQuery,
      },
    },
  },

  fromPrisma8Timestamp: (value: Date) => value,

  toPrisma8Timestamp: (value?: Date) => value ?? new Date(),

  isPrisma8UniqueViolation: (error: unknown) =>
    mockIsUniqueViolation(error) === true,
}));

import { AuthService } from './auth.service';

function createConfigService() {
  return {
    get: jest.fn((key: string) => {
      if (key === 'CLERK_SECRET_KEY') {
        return 'sk_test_contractflow';
      }

      return undefined;
    }),
  };
}

function createService() {
  return new AuthService(createConfigService() as never, {
    resolveForUser: jest.fn(),
  });
}

function createLifecycleService(resolveForUser: jest.Mock = jest.fn()) {
  return new AuthService(createConfigService() as never, {
    resolveForUser,
  });
}

function clerkUser(email = ' Invited@Example.com ') {
  return {
    id: 'clerk_user_1',
    firstName: 'Invited',
    lastName: 'User',
    imageUrl: 'https://images.example.test/avatar.png',
    primaryEmailAddressId: 'email_1',
    emailAddresses: [
      {
        id: 'email_1',
        emailAddress: email,
        verification: {
          status: 'verified',
        },
      },
    ],
  };
}

function pendingInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invite_1',
    organizationId: 'org_1',
    role: OrganizationRole.MANAGER,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    acceptedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function synchronizedUser() {
  return {
    id: 'user_db_1',
    clerkUserId: 'clerk_user_1',
    email: 'invited@example.com',
    firstName: 'Invited',
    lastName: 'User',
    imageUrl: 'https://images.example.test/avatar.png',
  };
}

function configureFirstTimeSynchronization() {
  userQuery.first
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      id: 'user_db_1',
    })
    .mockResolvedValueOnce(synchronizedUser());

  userQuery.create.mockResolvedValue({
    id: 'user_db_1',
  });

  userQuery.update.mockResolvedValue(undefined);

  membershipQuery.all.mockResolvedValue([]);

  mockGetUser.mockResolvedValue(clerkUser());
}

function configureSuccessfulTransaction() {
  mockTransaction.mockImplementation(
    async (
      callback: (tx: {
        orm: {
          public: {
            Membership: typeof txMembershipQuery;
            TeamInvitation: typeof txInvitationQuery;
          };
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        orm: {
          public: {
            Membership: txMembershipQuery,
            TeamInvitation: txInvitationQuery,
          },
        },
      }),
  );
}

describe('AuthService team invitation claiming', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userQuery.where.mockReturnValue(userQuery);
    userQuery.select.mockReturnValue(userQuery);

    membershipQuery.where.mockReturnValue(membershipQuery);
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.orderBy.mockReturnValue(membershipQuery);

    organizationQuery.where.mockReturnValue(organizationQuery);
    organizationQuery.select.mockReturnValue(organizationQuery);

    invitationQuery.where.mockReturnValue(invitationQuery);
    invitationQuery.select.mockReturnValue(invitationQuery);

    txMembershipQuery.where.mockReturnValue(txMembershipQuery);
    txMembershipQuery.select.mockReturnValue(txMembershipQuery);

    txInvitationQuery.where.mockReturnValue(txInvitationQuery);
    txInvitationQuery.select.mockReturnValue(txInvitationQuery);

    membershipQuery.first.mockResolvedValue(null);
    membershipQuery.all.mockResolvedValue([]);

    organizationQuery.first.mockResolvedValue(null);

    invitationQuery.first.mockResolvedValue(null);
    invitationQuery.all.mockResolvedValue([]);
    invitationQuery.update.mockResolvedValue(undefined);

    txMembershipQuery.first.mockResolvedValue(null);
    txMembershipQuery.create.mockResolvedValue({
      id: 'membership_1',
    });

    txInvitationQuery.first.mockResolvedValue(null);
    txInvitationQuery.update.mockResolvedValue(undefined);

    mockTransaction.mockReset();
    mockIsUniqueViolation.mockReturnValue(false);
  });

  it('claims a valid pending invitation during first synchronization', async () => {
    configureFirstTimeSynchronization();

    const invitation = pendingInvitation();

    invitationQuery.all.mockResolvedValue([invitation]);

    txInvitationQuery.first.mockResolvedValue(invitation);
    txMembershipQuery.first.mockResolvedValue(null);

    configureSuccessfulTransaction();

    const service = createService();

    await expect(service.synchronizeUser('clerk_user_1')).resolves.toEqual({
      ...synchronizedUser(),
      memberships: [],
    });

    expect(invitationQuery.where).toHaveBeenCalledWith({
      email: 'invited@example.com',
    });

    expect(txMembershipQuery.where).toHaveBeenCalledWith({
      userId: 'user_db_1',
      organizationId: 'org_1',
    });

    expect(txMembershipQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_db_1',
        organizationId: 'org_1',
        role: OrganizationRole.MANAGER,
      }),
    );

    expect(txInvitationQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedAt: expect.any(Date) as unknown,
        updatedAt: expect.any(Date) as unknown,
      }),
    );
  });

  it('normalizes the Clerk email before persisting and claiming', async () => {
    configureFirstTimeSynchronization();

    invitationQuery.all.mockResolvedValue([]);

    const service = createService();

    await service.synchronizeUser('clerk_user_1');

    expect(userQuery.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invited@example.com',
      }),
    );

    expect(userQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'invited@example.com',
      }),
    );

    expect(invitationQuery.where).toHaveBeenCalledWith({
      email: 'invited@example.com',
    });
  });

  it('does not claim revoked, expired, or already accepted invitations', async () => {
    configureFirstTimeSynchronization();

    invitationQuery.all.mockResolvedValue([
      pendingInvitation({
        id: 'invite_revoked',
        revokedAt: new Date(),
      }),

      pendingInvitation({
        id: 'invite_expired',
        expiresAt: new Date(Date.now() - 60_000),
      }),

      pendingInvitation({
        id: 'invite_accepted',
        acceptedAt: new Date(),
      }),
    ]);

    const service = createService();

    await service.synchronizeUser('clerk_user_1');

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(txMembershipQuery.create).not.toHaveBeenCalled();
    expect(txInvitationQuery.update).not.toHaveBeenCalled();
  });

  it('marks the invitation accepted when membership already exists', async () => {
    configureFirstTimeSynchronization();

    const invitation = pendingInvitation();

    invitationQuery.all.mockResolvedValue([invitation]);

    txInvitationQuery.first.mockResolvedValue(invitation);

    txMembershipQuery.first.mockResolvedValue({
      id: 'membership_existing',
    });

    configureSuccessfulTransaction();

    const service = createService();

    await service.synchronizeUser('clerk_user_1');

    expect(txMembershipQuery.create).not.toHaveBeenCalled();

    expect(txInvitationQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedAt: expect.any(Date) as unknown,
        updatedAt: expect.any(Date) as unknown,
      }),
    );
  });

  it('recovers a concurrent membership unique race outside the failed transaction', async () => {
    configureFirstTimeSynchronization();

    const invitation = pendingInvitation();

    invitationQuery.all.mockResolvedValue([invitation]);

    const uniqueError = new Error('membership unique violation');

    mockTransaction.mockRejectedValue(uniqueError);

    mockIsUniqueViolation.mockImplementation(
      (error: unknown) => error === uniqueError,
    );

    membershipQuery.first.mockResolvedValue({
      id: 'membership_concurrent',
    });

    invitationQuery.first.mockResolvedValue(invitation);
    invitationQuery.update.mockResolvedValue(undefined);

    const service = createService();

    await expect(service.synchronizeUser('clerk_user_1')).resolves.toEqual({
      ...synchronizedUser(),
      memberships: [],
    });

    expect(mockTransaction).toHaveBeenCalledTimes(1);

    expect(membershipQuery.where).toHaveBeenCalledWith({
      userId: 'user_db_1',
      organizationId: 'org_1',
    });

    expect(invitationQuery.first).toHaveBeenCalledTimes(1);

    expect(invitationQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        acceptedAt: expect.any(Date) as unknown,
        updatedAt: expect.any(Date) as unknown,
      }),
    );
  });

  it('propagates a non-unique transaction failure', async () => {
    configureFirstTimeSynchronization();

    const invitation = pendingInvitation();

    invitationQuery.all.mockResolvedValue([invitation]);

    const databaseError = new Error('database connection lost');

    mockTransaction.mockRejectedValue(databaseError);
    mockIsUniqueViolation.mockReturnValue(false);

    const service = createService();

    await expect(service.synchronizeUser('clerk_user_1')).rejects.toThrow(
      'database connection lost',
    );

    expect(invitationQuery.update).not.toHaveBeenCalled();
  });
});

describe('AuthService account lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userQuery.where.mockReturnValue(userQuery);
    userQuery.select.mockReturnValue(userQuery);
    userQuery.delete.mockResolvedValue(undefined);

    membershipQuery.where.mockReturnValue(membershipQuery);
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.all.mockResolvedValue([]);
    membershipQuery.delete.mockResolvedValue(undefined);

    mockDeleteUser.mockResolvedValue({
      id: 'clerk_user_1',
    });
  });

  it('allows an ordinary member to leave the organization', async () => {
    const resolveForUser = jest.fn().mockResolvedValue({
      id: 'membership_1',
      organizationId: 'org_1',
      role: OrganizationRole.VIEWER,
    });

    const service = createLifecycleService(resolveForUser);

    await expect(
      service.leaveOrganizationForUser('clerk_user_1', 'org_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(resolveForUser).toHaveBeenCalledWith('clerk_user_1', 'org_1');

    expect(membershipQuery.where).toHaveBeenCalledWith({
      id: 'membership_1',
    });

    expect(membershipQuery.delete).toHaveBeenCalledTimes(1);
  });

  it('allows an owner to leave when another owner remains', async () => {
    const resolveForUser = jest.fn().mockResolvedValue({
      id: 'membership_owner_1',
      organizationId: 'org_1',
      role: OrganizationRole.OWNER,
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_owner_1',
        role: OrganizationRole.OWNER,
      },
      {
        id: 'membership_owner_2',
        role: OrganizationRole.OWNER,
      },
    ]);

    const service = createLifecycleService(resolveForUser);

    await expect(
      service.leaveOrganizationForUser('clerk_owner_1', 'org_1'),
    ).resolves.toEqual({
      success: true,
    });

    expect(membershipQuery.delete).toHaveBeenCalledTimes(1);
  });

  it('blocks the final owner from leaving the organization', async () => {
    const resolveForUser = jest.fn().mockResolvedValue({
      id: 'membership_owner_1',
      organizationId: 'org_1',
      role: OrganizationRole.OWNER,
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_owner_1',
        role: OrganizationRole.OWNER,
      },
    ]);

    const service = createLifecycleService(resolveForUser);

    await expect(
      service.leaveOrganizationForUser('clerk_owner_1', 'org_1'),
    ).rejects.toThrow(
      'Transfer ownership before leaving or deleting your account',
    );

    expect(membershipQuery.delete).not.toHaveBeenCalled();
  });

  it('deletes an ordinary account from Clerk before deleting the local user', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_1',
        organizationId: 'org_1',
        role: OrganizationRole.VIEWER,
      },
    ]);

    const service = createLifecycleService();

    await expect(service.deleteAccountForUser('clerk_user_1')).resolves.toEqual(
      {
        success: true,
      },
    );

    expect(mockDeleteUser).toHaveBeenCalledWith('clerk_user_1');

    expect(userQuery.where).toHaveBeenCalledWith({
      id: 'user_db_1',
    });

    expect(userQuery.delete).toHaveBeenCalledTimes(1);

    expect(mockDeleteUser.mock.invocationCallOrder[0]).toBeLessThan(
      userQuery.delete.mock.invocationCallOrder[0],
    );
  });

  it('blocks account deletion when the user is the final owner', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          organizationId: 'org_1',
          role: OrganizationRole.OWNER,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          role: OrganizationRole.OWNER,
        },
      ]);

    const service = createLifecycleService();

    await expect(service.deleteAccountForUser('clerk_owner_1')).rejects.toThrow(
      'Transfer ownership before leaving or deleting your account',
    );

    expect(mockDeleteUser).not.toHaveBeenCalled();
    expect(userQuery.delete).not.toHaveBeenCalled();
  });

  it('keeps the local user when Clerk account deletion fails', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_1',
        organizationId: 'org_1',
        role: OrganizationRole.VIEWER,
      },
    ]);

    mockDeleteUser.mockRejectedValue(
      new Error('Clerk temporarily unavailable'),
    );

    const service = createLifecycleService();

    await expect(service.deleteAccountForUser('clerk_user_1')).rejects.toThrow(
      'Authentication provider is temporarily unavailable. Please try again.',
    );

    expect(mockDeleteUser).toHaveBeenCalledWith('clerk_user_1');
    expect(userQuery.delete).not.toHaveBeenCalled();
  });
});

describe('AuthService Clerk deletion cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    userQuery.where.mockReturnValue(userQuery);
    userQuery.select.mockReturnValue(userQuery);
    userQuery.delete.mockResolvedValue(undefined);

    membershipQuery.where.mockReturnValue(membershipQuery);
    membershipQuery.select.mockReturnValue(membershipQuery);
    membershipQuery.all.mockResolvedValue([]);
  });

  it('is idempotent when the deleted Clerk user has no local ContractFlow user', async () => {
    userQuery.first.mockResolvedValue(null);

    const service = createLifecycleService();

    await expect(
      service.handleClerkUserDeleted('clerk_missing'),
    ).resolves.toEqual({
      success: true,
      deleted: false,
      finalOwnerConflict: false,
    });

    expect(userQuery.delete).not.toHaveBeenCalled();
  });

  it('deletes an ordinary local user after Clerk reports user.deleted', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all.mockResolvedValue([
      {
        id: 'membership_1',
        organizationId: 'org_1',
        role: OrganizationRole.VIEWER,
      },
    ]);

    const service = createLifecycleService();

    await expect(
      service.handleClerkUserDeleted('clerk_user_1'),
    ).resolves.toEqual({
      success: true,
      deleted: true,
      finalOwnerConflict: false,
    });

    expect(userQuery.where).toHaveBeenLastCalledWith({
      id: 'user_db_1',
    });

    expect(userQuery.delete).toHaveBeenCalledTimes(1);
  });

  it('deletes an owner when another owner remains', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          organizationId: 'org_1',
          role: OrganizationRole.OWNER,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          role: OrganizationRole.OWNER,
        },
        {
          id: 'membership_owner_2',
          role: OrganizationRole.OWNER,
        },
      ]);

    const service = createLifecycleService();

    await expect(
      service.handleClerkUserDeleted('clerk_owner_1'),
    ).resolves.toEqual({
      success: true,
      deleted: true,
      finalOwnerConflict: false,
    });

    expect(userQuery.delete).toHaveBeenCalledTimes(1);
  });

  it('retains the local user when Clerk deletes the final organization owner', async () => {
    userQuery.first.mockResolvedValue({
      id: 'user_db_1',
    });

    membershipQuery.all
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          organizationId: 'org_1',
          role: OrganizationRole.OWNER,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'membership_owner_1',
          role: OrganizationRole.OWNER,
        },
      ]);

    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const service = createLifecycleService();

    await expect(
      service.handleClerkUserDeleted('clerk_owner_1'),
    ).resolves.toEqual({
      success: true,
      deleted: false,
      finalOwnerConflict: true,
    });

    expect(userQuery.delete).not.toHaveBeenCalled();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Clerk deleted final ContractFlow owner clerk_owner_1',
      ),
    );

    errorSpy.mockRestore();
  });
});
