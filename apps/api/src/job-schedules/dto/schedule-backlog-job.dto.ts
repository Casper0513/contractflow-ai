import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ScheduleBacklogJobDto {
  @IsISO8601()
  startAt!: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsOptional()
  @IsString()
  crewMemberId?: string | null;
}
