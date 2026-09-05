import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '@contractflow/db';

jest.mock('./organization-membership.service', () => ({
  OrganizationMembershipService: class OrganizationMembershipService {},
}));

import type { OrganizationMembershipService } from './organization-membership.service';
import { RolesGuard } from './roles.guard';

function createContext(authUser?: {
  clerkUserId: string;
  sessionId?: string;
  activeOrganizationId?: string;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        authUser,
      }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

let organizationMemberships: jest.Mocked<OrganizationMembershipService>;

function createMembership(role: OrganizationRole) {
  return {
    id: 'membership_1',
    userId: 'user_db_1',
    organizationId: 'org_1',
    role,
  };
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    organizationMemberships = {
      resolveForUser: jest.fn(),
    };
    guard = new RolesGuard(reflector, organizationMemberships);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows requests when no roles are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).resolves.toBe(true);

    expect(organizationMemberships.resolveForUser.mock.calls).toHaveLength(0);
  });

  it('rejects requests without an authenticated user', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([OrganizationRole.OWNER]);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects users without an organization membership', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([OrganizationRole.OWNER]);

    organizationMemberships.resolveForUser.mockRejectedValue(
      new NotFoundException('No organization membership found'),
    );

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a role that is not allowed', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    organizationMemberships.resolveForUser.mockResolvedValue(
      createMembership(OrganizationRole.VIEWER),
    );

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves roles against the explicitly selected organization', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([OrganizationRole.MANAGER]);

    organizationMemberships.resolveForUser.mockResolvedValue(
      createMembership(OrganizationRole.MANAGER),
    );

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
          activeOrganizationId: 'org_2',
        }),
      ),
    ).resolves.toBe(true);

    expect(organizationMemberships.resolveForUser.mock.calls).toContainEqual([
      'user_1',
      'org_2',
    ]);
  });

  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN])(
    'allows %s when the role is permitted',
    async (role) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([OrganizationRole.OWNER, OrganizationRole.ADMIN]);

      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    },
  );
});

describe('RolesGuard operational write permissions', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    organizationMemberships = {
      resolveForUser: jest.fn(),
    };
    guard = new RolesGuard(reflector, organizationMemberships);

    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([
        OrganizationRole.OWNER,
        OrganizationRole.ADMIN,
        OrganizationRole.MANAGER,
      ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    OrganizationRole.OWNER,
    OrganizationRole.ADMIN,
    OrganizationRole.MANAGER,
  ])('allows protected operational writes for %s', async (role) => {
    organizationMemberships.resolveForUser.mockResolvedValue(
      createMembership(role),
    );

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).resolves.toBe(true);
  });

  it.each([
    OrganizationRole.TECHNICIAN,
    OrganizationRole.OFFICE,
    OrganizationRole.VIEWER,
  ])('denies protected operational writes for %s', async (role) => {
    organizationMemberships.resolveForUser.mockResolvedValue(
      createMembership(role),
    );

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('RolesGuard office and financial permissions', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    organizationMemberships = {
      resolveForUser: jest.fn(),
    };
    guard = new RolesGuard(reflector, organizationMemberships);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('standard office writes', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
          OrganizationRole.OFFICE,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
      OrganizationRole.OFFICE,
    ])('allows standard office writes for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([OrganizationRole.TECHNICIAN, OrganizationRole.VIEWER])(
      'denies standard office writes for %s',
      async (role) => {
        organizationMemberships.resolveForUser.mockResolvedValue(
          createMembership(role),
        );

        await expect(
          guard.canActivate(
            createContext({
              clerkUserId: 'user_1',
            }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });

  describe('elevated financial actions', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
    ])('allows elevated financial actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([
      OrganizationRole.OFFICE,
      OrganizationRole.TECHNICIAN,
      OrganizationRole.VIEWER,
    ])('denies elevated financial actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

describe('RolesGuard field operations permissions', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    organizationMemberships = {
      resolveForUser: jest.fn(),
    };
    guard = new RolesGuard(reflector, organizationMemberships);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('field execution writes', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
          OrganizationRole.TECHNICIAN,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
      OrganizationRole.TECHNICIAN,
    ])('allows field execution writes for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([OrganizationRole.OFFICE, OrganizationRole.VIEWER])(
      'denies field execution writes for %s',
      async (role) => {
        organizationMemberships.resolveForUser.mockResolvedValue(
          createMembership(role),
        );

        await expect(
          guard.canActivate(
            createContext({
              clerkUserId: 'user_1',
            }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });

  describe('shared operational writes', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
          OrganizationRole.OFFICE,
          OrganizationRole.TECHNICIAN,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
      OrganizationRole.OFFICE,
      OrganizationRole.TECHNICIAN,
    ])('allows shared operational writes for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it('denies shared operational writes for VIEWER', async () => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(OrganizationRole.VIEWER),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('destructive field actions', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
    ])('allows destructive field actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([
      OrganizationRole.OFFICE,
      OrganizationRole.TECHNICIAN,
      OrganizationRole.VIEWER,
    ])('denies destructive field actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});

describe('RolesGuard job and AI permissions', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    organizationMemberships = {
      resolveForUser: jest.fn(),
    };
    guard = new RolesGuard(reflector, organizationMemberships);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('job administration and office AI', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
          OrganizationRole.OFFICE,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
      OrganizationRole.OFFICE,
    ])('allows job administration and office AI for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([OrganizationRole.TECHNICIAN, OrganizationRole.VIEWER])(
      'denies job administration and office AI for %s',
      async (role) => {
        organizationMemberships.resolveForUser.mockResolvedValue(
          createMembership(role),
        );

        await expect(
          guard.canActivate(
            createContext({
              clerkUserId: 'user_1',
            }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });

  describe('manager-only job lifecycle and dispatch AI', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
    ])('allows manager-only actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([
      OrganizationRole.OFFICE,
      OrganizationRole.TECHNICIAN,
      OrganizationRole.VIEWER,
    ])('denies manager-only actions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('field AI task suggestions', () => {
    beforeEach(() => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([
          OrganizationRole.OWNER,
          OrganizationRole.ADMIN,
          OrganizationRole.MANAGER,
          OrganizationRole.TECHNICIAN,
        ]);
    });

    it.each([
      OrganizationRole.OWNER,
      OrganizationRole.ADMIN,
      OrganizationRole.MANAGER,
      OrganizationRole.TECHNICIAN,
    ])('allows field AI task suggestions for %s', async (role) => {
      organizationMemberships.resolveForUser.mockResolvedValue(
        createMembership(role),
      );

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it.each([OrganizationRole.OFFICE, OrganizationRole.VIEWER])(
      'denies field AI task suggestions for %s',
      async (role) => {
        organizationMemberships.resolveForUser.mockResolvedValue(
          createMembership(role),
        );

        await expect(
          guard.canActivate(
            createContext({
              clerkUserId: 'user_1',
            }),
          ),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });
});
