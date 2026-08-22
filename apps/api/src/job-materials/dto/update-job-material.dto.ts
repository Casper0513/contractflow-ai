import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JobMaterialUnit } from '@contractflow/db';

export class UpdateJobMaterialDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  quantity?: number;

  @IsOptional()
  @IsEnum(JobMaterialUnit)
  unit?: JobMaterialUnit;

  @IsOptional()
  @IsString()
  supplier?: string | null;

  @IsOptional()
  @IsString()
  sku?: string | null;

  @IsOptional()
  @IsString()
  reference?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedUnitCostCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualUnitCostCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  billableUnitPriceCents?: number | null;
}
