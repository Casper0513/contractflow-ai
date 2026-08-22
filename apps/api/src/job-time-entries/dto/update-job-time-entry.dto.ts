import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateJobTimeEntryDto {
  @IsOptional()
  @IsString()
  crewMemberId?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
