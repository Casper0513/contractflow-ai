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

export class CreateJobMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({
    maxDecimalPlaces: 3,
  })
  @Min(0.001)
  quantity!: number;

  @IsEnum(JobMaterialUnit)
  unit!: JobMaterialUnit;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedUnitCostCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualUnitCostCents?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  billableUnitPriceCents?: number;
}
