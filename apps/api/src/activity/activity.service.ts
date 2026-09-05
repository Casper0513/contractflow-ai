import { Injectable } from '@nestjs/common';
import { CustomerActivityType } from '@contractflow/db';
import {
  type DatabaseTransaction,
  db,
  fromPrisma8Timestamp,
  toPrisma8Timestamp,
} from '@contractflow/db-prisma8';

type ActivityOrmSource = typeof db.orm;

type CustomerActivityCreateInput = Parameters<
  DatabaseTransaction['orm']['public']['CustomerActivity']['create']
>[0];

type ActivityMetadata = CustomerActivityCreateInput['metadata'];

type RecordCustomerActivityInput = {
  organizationId: string;
  customerId: string;

  actorUserId?: string | null;

  type: CustomerActivityType;

  title: string;

  description?: string;

  metadata?: ActivityMetadata;
};

@Injectable()
export class ActivityService {
  async recordCustomerActivity(
    input: RecordCustomerActivityInput,

    tx?: DatabaseTransaction,
  ) {
    const orm = tx?.orm ?? db.orm;

    const activity = await orm.public.CustomerActivity.create({
      organizationId: input.organizationId,

      customerId: input.customerId,

      actorUserId: input.actorUserId ?? null,

      _type: input.type,

      title: input.title,

      description: input.description ?? null,

      metadata: input.metadata,

      createdAt: toPrisma8Timestamp(),
    });

    return {
      ...activity,

      type: activity._type,

      createdAt: fromPrisma8Timestamp(activity.createdAt),
    };
  }

  async listCustomerActivity(organizationId: string, customerId: string) {
    return this.listActivity(organizationId, customerId);
  }

  async listJobActivity(
    organizationId: string,
    customerId: string,
    jobId: string,
  ) {
    const activities = await this.listActivity(organizationId, customerId);

    /*
     * Prisma 7 previously used a JSON-path predicate:
     *
     * metadata.path = ['jobId']
     * metadata.equals = jobId
     *
     * Keep the same observable behavior without relying on
     * an unproven Prisma 8 JSON-path query API.
     */
    return activities.filter((activity) =>
      this.metadataHasJobId(activity.metadata, jobId),
    );
  }

  private async listActivity(
    organizationId: string,
    customerId: string,
    orm: ActivityOrmSource = db.orm,
  ) {
    const activities = await orm.public.CustomerActivity.where({
      organizationId,
      customerId,
    })
      .select(
        'id',
        '_type',
        'title',
        'description',
        'metadata',
        'createdAt',
        'actorUserId',
      )
      .orderBy((model) => model.createdAt.desc())
      .all();

    const actorCache = new Map<
      string,
      {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
      } | null
    >();

    const result = [];

    for (const activity of activities) {
      let actor: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
      } | null = null;

      if (activity.actorUserId) {
        if (actorCache.has(activity.actorUserId)) {
          actor = actorCache.get(activity.actorUserId) ?? null;
        } else {
          actor = await orm.public.User.where({
            id: activity.actorUserId,
          })
            .select('id', 'firstName', 'lastName', 'email')
            .first();

          actorCache.set(activity.actorUserId, actor);
        }
      }

      result.push({
        id: activity.id,

        type: activity._type,

        title: activity.title,

        description: activity.description,

        metadata: activity.metadata,

        createdAt: fromPrisma8Timestamp(activity.createdAt),

        actor,
      });
    }

    return result;
  }

  private metadataHasJobId(metadata: unknown, jobId: string) {
    if (
      metadata === null ||
      typeof metadata !== 'object' ||
      Array.isArray(metadata)
    ) {
      return false;
    }

    return (metadata as Record<string, unknown>).jobId === jobId;
  }
}
