import { BadRequestException } from '@nestjs/common';
import { prisma } from '@contractflow/db';

import { OrganizationMembershipService } from './auth/organization-membership.service';
import { CrewService } from './crew/crew.service';
import { JobTimeEntriesService } from './job-time-entries/job-time-entries.service';

type TransactionHost = {
  $transaction(
    callback: (client: unknown) => Promise<unknown>,
  ): Promise<unknown>;
};

type TimeEntryUpdateArgument = {
  where: {
    id: string;
  };
  data: Record<string, unknown>;
  select?: unknown;
};

function createMembershipService(): OrganizationMembershipService {
  return {
    resolveForUser: jest.fn().mockResolvedValue({
      id: 'membership_1',
      userId: 'user_db_1',
      organizationId: 'org_1',
      role: 'OWNER',
    }),
  };
}

function mockTransaction(client: unknown) {
  const transactionHost = prisma as unknown as TransactionHost;

  jest
    .spyOn(transactionHost, '$transaction')
    .mockImplementation(async (callback) => callback(client));
}

function createExistingTimeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry_1',
    organizationId: 'org_1',
    jobId: 'job_1',
    crewMemberId: 'crew_1',
    createdByUserId: 'user_db_1',

    startedAt: new Date('2026-09-02T08:00:00.000Z'),
    endedAt: new Date('2026-09-02T10:00:00.000Z'),

    hourlyCostCents: 5000,
    laborCostCents: 10000,
    currency: 'JPY',

    notes: 'Original note',

    createdAt: new Date('2026-09-02T08:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),

    crewMember: {
      id: 'crew_1',
      firstName: 'Avery',
      lastName: 'Worker',
      email: null,
      phone: null,
      active: true,
    },

    createdBy: {
      id: 'user_db_1',
      firstName: 'Owner',
      lastName: 'User',
      email: 'owner@example.com',
    },

    ...overrides,
  };
}

describe('Crew and job time-entry currency invariants', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('copies the organization currency onto a new crew member', async () => {
    const membershipService = createMembershipService();
    const service = new CrewService(membershipService);

    const organizationFindUnique = jest
      .spyOn(prisma.organization, 'findUnique')
      .mockResolvedValue({
        currency: 'JPY',
      } as never);

    const crewMemberCreate = jest
      .spyOn(prisma.crewMember, 'create')
      .mockResolvedValue({
        id: 'crew_1',
        organizationId: 'org_1',
        firstName: 'Avery',
        lastName: null,
        email: null,
        phone: null,
        hourlyCostCents: 5000,
        currency: 'JPY',
        dailyCapacityMinutes: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: {
          timeEntries: 0,
          scheduleAssignments: 0,
        },
      } as never);

    await service.createForUser(
      'clerk_user_1',
      {
        firstName: 'Avery',
        hourlyCostCents: 5000,
      },
      'org_1',
    );

    expect(organizationFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'org_1',
      },
      select: {
        currency: true,
      },
    });

    expect(crewMemberCreate).toHaveBeenCalledTimes(1);

    expect(crewMemberCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        organizationId: 'org_1',
        hourlyCostCents: 5000,
        currency: 'JPY',
      },
    });
  });

  it('copies the job currency onto a new time-entry labor snapshot', async () => {
    const membershipService = createMembershipService();
    const service = new JobTimeEntriesService(membershipService);

    const timeEntryCreate = jest
      .fn<Promise<unknown>, [unknown]>()
      .mockResolvedValue({
        id: 'entry_1',
        currency: 'JPY',
      });

    const transactionClient = {
      job: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          currency: 'JPY',
        }),
      },

      crewMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'crew_1',
          hourlyCostCents: 5000,
          currency: 'JPY',
        }),
      },

      jobTimeEntry: {
        create: timeEntryCreate,
      },
    };

    mockTransaction(transactionClient);

    await service.createForUser(
      'clerk_user_1',
      'job_1',
      {
        crewMemberId: 'crew_1',
        startedAt: '2026-09-02T08:00:00.000Z',
        endedAt: '2026-09-02T10:00:00.000Z',
        notes: 'Install work',
      },
      'org_1',
    );

    expect(timeEntryCreate).toHaveBeenCalledTimes(1);

    expect(timeEntryCreate.mock.calls[0]?.[0]).toMatchObject({
      data: {
        organizationId: 'org_1',
        jobId: 'job_1',
        crewMemberId: 'crew_1',

        hourlyCostCents: 5000,
        laborCostCents: 10000,
        currency: 'JPY',
      },
    });
  });

  it('rejects time-entry creation when crew and job currencies differ', async () => {
    const membershipService = createMembershipService();
    const service = new JobTimeEntriesService(membershipService);

    const timeEntryCreate = jest.fn();

    const transactionClient = {
      job: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          currency: 'JPY',
        }),
      },

      crewMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'crew_1',
          hourlyCostCents: 5000,
          currency: 'USD',
        }),
      },

      jobTimeEntry: {
        create: timeEntryCreate,
      },
    };

    mockTransaction(transactionClient);

    await expect(
      service.createForUser(
        'clerk_user_1',
        'job_1',
        {
          crewMemberId: 'crew_1',
          startedAt: '2026-09-02T08:00:00.000Z',
          endedAt: '2026-09-02T10:00:00.000Z',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Crew member hourly cost currency must match the job currency',
    );

    await expect(
      service.createForUser(
        'clerk_user_1',
        'job_1',
        {
          crewMemberId: 'crew_1',
          startedAt: '2026-09-02T08:00:00.000Z',
          endedAt: '2026-09-02T10:00:00.000Z',
        },
        'org_1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(timeEntryCreate).not.toHaveBeenCalled();
  });

  it('rejects reassignment to a crew member whose currency differs from the job', async () => {
    const membershipService = createMembershipService();
    const service = new JobTimeEntriesService(membershipService);

    const timeEntryUpdate = jest.fn();

    const transactionClient = {
      job: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          currency: 'JPY',
        }),
      },

      jobTimeEntry: {
        findFirst: jest.fn().mockResolvedValue(createExistingTimeEntry()),
        update: timeEntryUpdate,
      },

      crewMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'crew_2',
          hourlyCostCents: 6500,
          currency: 'USD',
        }),
      },
    };

    mockTransaction(transactionClient);

    await expect(
      service.updateForUser(
        'clerk_user_1',
        'job_1',
        'entry_1',
        {
          crewMemberId: 'crew_2',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Crew member hourly cost currency must match the job currency',
    );

    expect(timeEntryUpdate).not.toHaveBeenCalled();
  });

  it('preserves the existing time-entry currency when editing dates or notes', async () => {
    const membershipService = createMembershipService();
    const service = new JobTimeEntriesService(membershipService);

    const existing = createExistingTimeEntry();

    const timeEntryUpdate = jest
      .fn<Promise<unknown>, [TimeEntryUpdateArgument]>()
      .mockResolvedValue({
        ...existing,
        notes: 'Updated note',
      });

    const transactionClient = {
      job: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          currency: 'JPY',
        }),
      },

      jobTimeEntry: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: timeEntryUpdate,
      },

      crewMember: {
        findFirst: jest.fn(),
      },
    };

    mockTransaction(transactionClient);

    await service.updateForUser(
      'clerk_user_1',
      'job_1',
      'entry_1',
      {
        startedAt: '2026-09-02T09:00:00.000Z',
        endedAt: '2026-09-02T11:00:00.000Z',
        notes: 'Updated note',
      },
      'org_1',
    );

    expect(transactionClient.crewMember.findFirst).not.toHaveBeenCalled();

    expect(timeEntryUpdate).toHaveBeenCalledTimes(1);

    const updateArgument = timeEntryUpdate.mock.calls[0]?.[0];

    expect(updateArgument).toMatchObject({
      where: {
        id: 'entry_1',
      },

      data: {
        crewMemberId: 'crew_1',

        startedAt: new Date('2026-09-02T09:00:00.000Z'),
        endedAt: new Date('2026-09-02T11:00:00.000Z'),

        hourlyCostCents: 5000,
        laborCostCents: 10000,

        notes: 'Updated note',
      },
    });

    expect(updateArgument?.data).not.toHaveProperty('currency');
  });

  it('rejects an existing time entry whose currency no longer matches its job', async () => {
    const membershipService = createMembershipService();
    const service = new JobTimeEntriesService(membershipService);

    const timeEntryUpdate = jest.fn();

    const transactionClient = {
      job: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'job_1',
          currency: 'JPY',
        }),
      },

      jobTimeEntry: {
        findFirst: jest.fn().mockResolvedValue(
          createExistingTimeEntry({
            currency: 'USD',
          }),
        ),
        update: timeEntryUpdate,
      },

      crewMember: {
        findFirst: jest.fn(),
      },
    };

    mockTransaction(transactionClient);

    await expect(
      service.updateForUser(
        'clerk_user_1',
        'job_1',
        'entry_1',
        {
          notes: 'Attempted edit',
        },
        'org_1',
      ),
    ).rejects.toThrow(
      'Job time entry currency does not match the job currency',
    );

    expect(timeEntryUpdate).not.toHaveBeenCalled();
  });
});
