import { OrganizationRole } from '@contractflow/db';
import { IsEmail, IsEnum, MaxLength } from 'class-validator';

export class InviteTeamMemberDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}
