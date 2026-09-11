import { OrganizationRole } from '@contractflow/db';
import { IsEnum } from 'class-validator';

export class UpdateTeamMemberRoleDto {
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
