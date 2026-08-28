import { IsNotEmpty, IsString } from 'class-validator';

export class AssignJobScheduleCrewMemberDto {
  @IsString()
  @IsNotEmpty()
  crewMemberId!: string;
}
