import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { JobCostCategory } from '@contractflow/db';

export class CreateJobCostDto {
  @IsEnum(JobCostCategory)
  category!: JobCostCategory;

  @IsString()
  description!: string;

  @IsInt()
  @Min(0)
  amountCents!: number;

  @IsOptional()
  @IsDateString()
  incurredAt?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
