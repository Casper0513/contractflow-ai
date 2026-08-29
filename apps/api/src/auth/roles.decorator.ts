import { SetMetadata } from '@nestjs/common';
import type { OrganizationRole } from '@contractflow/db';

export const ORGANIZATION_ROLES_KEY = 'organizationRoles';

export const Roles = (...roles: OrganizationRole[]) =>
  SetMetadata(ORGANIZATION_ROLES_KEY, roles);
