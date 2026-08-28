import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class DispatchJobScheduleDto {
  @IsISO8601()
  startAt!: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @IsOptional()
  @IsString()
  sourceCrewMemberId?: string | null;

  @IsOptional()
  @IsString()
  targetCrewMemberId?: string | null;
}
