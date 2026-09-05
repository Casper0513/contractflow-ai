const mockTransaction = jest.fn();
const mockTimestamp = jest.fn(() => 'TIMESTAMP');

jest.mock('@contractflow/db-prisma8', () => ({
  db: {
    orm: {},
    transaction: mockTransaction,
  },
  toPrisma8Timestamp: mockTimestamp,
  fromPrisma8Timestamp: jest.fn((value: unknown) => value),
}));

import { JobChecklistsService } from './job-checklists.service';

type MockTransactionCallback = (tx: { orm: unknown }) => Promise<unknown>;

describe('JobChecklistsService', () => {
  const membershipService = {
    resolveForUser: jest.fn(),
  };

  let service: JobChecklistsService;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new JobChecklistsService(membershipService);

    membershipService.resolveForUser.mockResolvedValue({
      organizationId: 'org-1',
      userId: 'user-1',
    });
  });

  it('completes a checklist item and records activity in the same transaction', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const checklistFirst = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      sourceTemplateId: null,
      createdByUserId: null,
      name: 'Final Inspection',
      description: null,
      createdAt: 'created',
      updatedAt: 'updated',
    });

    const itemReads = [
      {
        id: 'item-1',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        completedAt: null,
        completedByUserId: null,
        createdAt: 'created',
        updatedAt: 'updated',
      },
      {
        id: 'item-1',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        completedAt: 'completed',
        completedByUserId: 'user-1',
        createdAt: 'created',
        updatedAt: 'updated',
      },
    ];

    const itemFirst = jest
      .fn()
      .mockImplementation(() => Promise.resolve(itemReads.shift()));

    const itemUpdate = jest.fn().mockResolvedValue({});

    const completedByFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });

    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity-1',
    });

    const txOrm = {
      public: {
        Job: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jobFirst,
            })),
          })),
        },

        JobChecklist: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: checklistFirst,
            })),
          })),
        },

        JobChecklistItem: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: itemFirst,
            })),
            update: itemUpdate,
          })),
        },

        User: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: completedByFirst,
            })),
          })),
        },

        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.completeItemForUser(
      'clerk-user',
      'job-1',
      'checklist-1',
      'item-1',
      'org-1',
    );

    expect(membershipService.resolveForUser).toHaveBeenCalledWith(
      'clerk-user',
      'org-1',
    );

    expect(itemUpdate).toHaveBeenCalledWith({
      completedAt: 'TIMESTAMP',
      completedByUserId: 'user-1',
      updatedAt: 'TIMESTAMP',
    });

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const completedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          organizationId?: string;
          customerId?: string;
          actorUserId?: string | null;
          _type?: string;
          title?: string;
          metadata?: unknown;
        },
      ]
    >;
    const completedActivityArg = completedActivityCalls[0]?.[0];

    expect(completedActivityArg).toMatchObject({
      organizationId: 'org-1',
      customerId: 'customer-1',
      actorUserId: 'user-1',
      _type: 'JOB_CHECKLIST_ITEM_COMPLETED',
      title: 'Checklist item completed',
    });

    expect(completedActivityArg?.metadata).toMatchObject({
      jobId: 'job-1',
      checklistId: 'checklist-1',
      itemId: 'item-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'item-1',
        title: 'Test smoke alarms',
        completedByUserId: 'user-1',
        completedBy: {
          id: 'user-1',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        },
      }),
    );

    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(activityCreate).toHaveBeenCalledTimes(1);
  });
  it('does not create duplicate activity when completing an already completed item', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const checklistFirst = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      sourceTemplateId: null,
      createdByUserId: null,
      name: 'Final Inspection',
      description: null,
      createdAt: 'created',
      updatedAt: 'updated',
    });

    const completedItem = {
      id: 'item-1',
      organizationId: 'org-1',
      checklistId: 'checklist-1',
      title: 'Test smoke alarms',
      description: null,
      position: 0,
      required: true,
      completedAt: 'completed',
      completedByUserId: 'user-1',
      createdAt: 'created',
      updatedAt: 'updated',
    };

    const itemFirst = jest.fn().mockResolvedValue(completedItem);

    const userFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });

    const activityCreate = jest.fn();

    const txOrm = {
      public: {
        Job: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jobFirst,
            })),
          })),
        },
        JobChecklist: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: checklistFirst,
            })),
          })),
        },
        JobChecklistItem: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: itemFirst,
            })),
            update: jest.fn(),
          })),
        },
        User: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: userFirst,
            })),
          })),
        },
        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.completeItemForUser(
      'clerk-user',
      'job-1',
      'checklist-1',
      'item-1',
      'org-1',
    );

    expect(activityCreate).not.toHaveBeenCalled();

    expect(result).toEqual(
      expect.objectContaining({
        id: 'item-1',
        completedByUserId: 'user-1',
      }),
    );
  });

  it('reopens a checklist item and records activity in the same transaction', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const checklistFirst = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      sourceTemplateId: null,
      createdByUserId: null,
      name: 'Final Inspection',
      description: null,
      createdAt: 'created',
      updatedAt: 'updated',
    });

    const itemReads = [
      {
        id: 'item-1',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        completedAt: 'completed',
        completedByUserId: 'user-1',
        createdAt: 'created',
        updatedAt: 'updated',
      },
      {
        id: 'item-1',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        completedAt: null,
        completedByUserId: null,
        createdAt: 'created',
        updatedAt: 'updated',
      },
    ];

    const itemFirst = jest
      .fn()
      .mockImplementation(() => Promise.resolve(itemReads.shift()));

    const itemUpdate = jest.fn().mockResolvedValue({});
    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity-1',
    });

    const txOrm = {
      public: {
        Job: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jobFirst,
            })),
          })),
        },
        JobChecklist: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: checklistFirst,
            })),
          })),
        },
        JobChecklistItem: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: itemFirst,
            })),
            update: itemUpdate,
          })),
        },
        User: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jest.fn().mockResolvedValue(null),
            })),
          })),
        },
        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.reopenItemForUser(
      'clerk-user',
      'job-1',
      'checklist-1',
      'item-1',
      'org-1',
    );

    expect(itemUpdate).toHaveBeenCalledWith({
      completedAt: null,
      completedByUserId: null,
      updatedAt: 'TIMESTAMP',
    });

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const reopenedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const reopenedActivityArg = reopenedActivityCalls[0]?.[0];

    expect(reopenedActivityArg).toMatchObject({
      _type: 'JOB_CHECKLIST_ITEM_REOPENED',
    });

    expect(reopenedActivityArg?.metadata).toMatchObject({
      jobId: 'job-1',
      checklistId: 'checklist-1',
      itemId: 'item-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'item-1',
        completedAt: null,
        completedByUserId: null,
      }),
    );
  });

  it('deletes a checklist and records activity in the same transaction', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const checklistFirst = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      sourceTemplateId: null,
      createdByUserId: null,
      name: 'Final Inspection',
      description: null,
      createdAt: 'created',
      updatedAt: 'updated',
    });

    const deleteChecklist = jest.fn().mockResolvedValue({});

    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity-1',
    });

    const txOrm = {
      public: {
        Job: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jobFirst,
            })),
          })),
        },
        JobChecklist: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: checklistFirst,
            })),
            delete: deleteChecklist,
          })),
        },
        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.deleteForUser(
      'clerk-user',
      'job-1',
      'checklist-1',
      'org-1',
    );

    expect(deleteChecklist).toHaveBeenCalledWith();

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const deletedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const deletedActivityArg = deletedActivityCalls[0]?.[0];

    expect(deletedActivityArg).toMatchObject({
      _type: 'JOB_CHECKLIST_DELETED',
    });

    expect(deletedActivityArg?.metadata).toMatchObject({
      jobId: 'job-1',
      checklistId: 'checklist-1',
    });

    expect(result).toEqual({
      success: true,
    });
  });

  it('applies a checklist template and records activity in the same transaction', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const existingChecklistFirst = jest.fn().mockResolvedValue(null);

    const templateFirst = jest.fn().mockResolvedValue({
      id: 'template-1',
      name: 'Final Inspection',
      description: 'Complete final checks',
    });

    const templateItemsAll = jest.fn().mockResolvedValue([
      {
        id: 'template-item-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        createdAt: 'created',
      },
      {
        id: 'template-item-2',
        title: 'Check doors',
        description: null,
        position: 1,
        required: false,
        createdAt: 'created',
      },
    ]);

    const checklistCreate = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      name: 'Final Inspection',
    });

    const itemCreate = jest.fn().mockResolvedValue({});

    const checklistShapeFirst = jest.fn().mockResolvedValue({
      id: 'checklist-1',
      organizationId: 'org-1',
      jobId: 'job-1',
      sourceTemplateId: 'template-1',
      createdByUserId: 'user-1',
      name: 'Final Inspection',
      description: 'Complete final checks',
      createdAt: 'created',
      updatedAt: 'updated',
    });

    const checklistItemsAll = jest.fn().mockResolvedValue([
      {
        id: 'item-1',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Test smoke alarms',
        description: null,
        position: 0,
        required: true,
        completedAt: null,
        completedByUserId: null,
        createdAt: 'created',
        updatedAt: 'updated',
      },
      {
        id: 'item-2',
        organizationId: 'org-1',
        checklistId: 'checklist-1',
        title: 'Check doors',
        description: null,
        position: 1,
        required: false,
        completedAt: null,
        completedByUserId: null,
        createdAt: 'created',
        updatedAt: 'updated',
      },
    ]);

    const userFirst = jest.fn().mockResolvedValue({
      id: 'user-1',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
    });

    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity-1',
    });

    const jobWhere = jest.fn(() => ({
      select: jest.fn(() => ({
        first: jobFirst,
      })),
    }));

    let jobChecklistWhereCall = 0;

    const jobChecklistWhere = jest.fn(() => {
      jobChecklistWhereCall += 1;

      if (jobChecklistWhereCall === 1) {
        return {
          select: jest.fn(() => ({
            first: existingChecklistFirst,
          })),
        };
      }

      return {
        select: jest.fn(() => ({
          first: checklistShapeFirst,
        })),
      };
    });

    const txOrm = {
      public: {
        Job: {
          where: jobWhere,
        },

        JobChecklist: {
          where: jobChecklistWhere,
          create: checklistCreate,
        },

        ChecklistTemplate: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: templateFirst,
            })),
          })),
        },

        ChecklistTemplateItem: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                all: templateItemsAll,
              })),
            })),
          })),
        },

        JobChecklistItem: {
          create: itemCreate,
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                all: checklistItemsAll,
              })),
            })),
          })),
        },

        User: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: userFirst,
            })),
          })),
        },

        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.applyTemplateForUser(
      'clerk-user',
      'job-1',
      {
        templateId: 'template-1',
      },
      'org-1',
    );

    expect(checklistCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        jobId: 'job-1',
        sourceTemplateId: 'template-1',
        createdByUserId: 'user-1',
        name: 'Final Inspection',
      }),
    );

    expect(itemCreate).toHaveBeenCalledTimes(2);

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const createdActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const createdActivityArg = createdActivityCalls[0]?.[0];

    expect(createdActivityArg).toMatchObject({
      _type: 'JOB_CHECKLIST_CREATED',
    });

    expect(createdActivityArg?.metadata).toMatchObject({
      jobId: 'job-1',
      checklistId: 'checklist-1',
      sourceTemplateId: 'template-1',
      itemCount: 2,
    });

    expect(result).toMatchObject({
      id: 'checklist-1',
      name: 'Final Inspection',
    });
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('updates a checklist and records activity only when values change', async () => {
    const jobFirst = jest.fn().mockResolvedValue({
      id: 'job-1',
      name: 'Kitchen Remodel',
      customerId: 'customer-1',
      archivedAt: null,
    });

    const checklistReads = [
      {
        id: 'checklist-1',
        organizationId: 'org-1',
        jobId: 'job-1',
        sourceTemplateId: null,
        createdByUserId: null,
        name: 'Old Name',
        description: 'Old description',
        createdAt: 'created',
        updatedAt: 'updated',
      },
      {
        id: 'checklist-1',
        organizationId: 'org-1',
        jobId: 'job-1',
        sourceTemplateId: null,
        createdByUserId: null,
        name: 'New Name',
        description: 'Old description',
        createdAt: 'created',
        updatedAt: 'updated',
      },
    ];

    const checklistFirst = jest
      .fn()
      .mockImplementation(() => Promise.resolve(checklistReads.shift()));

    const checklistUpdate = jest.fn().mockResolvedValue({});

    const checklistItemsAll = jest.fn().mockResolvedValue([]);

    const activityCreate = jest.fn().mockResolvedValue({
      id: 'activity-1',
    });

    const txOrm = {
      public: {
        Job: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jobFirst,
            })),
          })),
        },

        JobChecklist: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: checklistFirst,
            })),
            update: checklistUpdate,
          })),
        },

        JobChecklistItem: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              orderBy: jest.fn(() => ({
                all: checklistItemsAll,
              })),
            })),
          })),
        },

        User: {
          where: jest.fn(() => ({
            select: jest.fn(() => ({
              first: jest.fn().mockResolvedValue(null),
            })),
          })),
        },

        CustomerActivity: {
          create: activityCreate,
        },
      },
    };

    mockTransaction.mockImplementation((callback: MockTransactionCallback) =>
      callback({
        orm: txOrm,
      }),
    );

    const result = await service.updateForUser(
      'clerk-user',
      'job-1',
      'checklist-1',
      {
        name: 'New Name',
      },
      'org-1',
    );

    expect(checklistUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Name',
        description: 'Old description',
        updatedAt: 'TIMESTAMP',
      }),
    );

    expect(activityCreate).toHaveBeenCalledTimes(1);

    const updatedActivityCalls = activityCreate.mock.calls as Array<
      [
        {
          _type?: string;
          metadata?: unknown;
        },
      ]
    >;
    const updatedActivityArg = updatedActivityCalls[0]?.[0];

    expect(updatedActivityArg).toMatchObject({
      _type: 'JOB_CHECKLIST_UPDATED',
    });

    expect(updatedActivityArg?.metadata).toMatchObject({
      checklistId: 'checklist-1',
      changes: {
        name: {
          oldValue: 'Old Name',
          newValue: 'New Name',
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        id: 'checklist-1',
        name: 'New Name',
      }),
    );
  });
});
