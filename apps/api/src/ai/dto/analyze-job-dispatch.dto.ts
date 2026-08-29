import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class JobDispatchCandidateDto {
  @IsInt()
  @Min(1)
  @Max(3)
  rank!: number;

  @IsString()
  crewMemberId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsISO8601()
  startAt!: string;

  @IsInt()
  @Min(0)
  utilizationPercent!: number;

  @IsInt()
  @Min(0)
  remainingMinutes!: number;
}

export class AnalyzeJobDispatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => JobDispatchCandidateDto)
  candidates!: JobDispatchCandidateDto[];
}
