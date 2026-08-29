import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole, prisma } from '@contractflow/db';

import { RolesGuard } from './roles.guard';

function createContext(authUser?: {
  clerkUserId: string;
  sessionId?: string;
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

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    jest.restoreAllMocks();

    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows requests when no roles are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const membershipSpy = jest.spyOn(prisma.membership, 'findFirst');

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).resolves.toBe(true);

    expect(membershipSpy).not.toHaveBeenCalled();
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

    jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue(null);

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

    jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
      role: OrganizationRole.VIEWER,
    } as never);

    await expect(
      guard.canActivate(
        createContext({
          clerkUserId: 'user_1',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([OrganizationRole.OWNER, OrganizationRole.ADMIN])(
    'allows %s when the role is permitted',
    async (role) => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue([OrganizationRole.OWNER, OrganizationRole.ADMIN]);

      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
    guard = new RolesGuard(reflector);

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
    jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
      role,
    } as never);

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
    jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
      role,
    } as never);

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
    guard = new RolesGuard(reflector);
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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
        jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
          role,
        } as never);

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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
    guard = new RolesGuard(reflector);
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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
        jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
          role,
        } as never);

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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

      await expect(
        guard.canActivate(
          createContext({
            clerkUserId: 'user_1',
          }),
        ),
      ).resolves.toBe(true);
    });

    it('denies shared operational writes for VIEWER', async () => {
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role: OrganizationRole.VIEWER,
      } as never);

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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
      jest.spyOn(prisma.membership, 'findFirst').mockResolvedValue({
        role,
      } as never);

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
