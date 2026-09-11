import { OrganizationRole } from '@contractflow/db';

const mockGetUser = jest.fn();
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
  return new AuthService(createConfigService() as never);
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
