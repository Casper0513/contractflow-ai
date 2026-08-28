import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ScheduleBacklogJobDto {
  @IsISO8601()
  startAt!: string;

  @IsOptional()
  @IsString()
  crewMemberId?: string | null;
}
