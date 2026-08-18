import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateEstimateLineItemDto {
  @IsString()
  description!: string;

  @IsNumber({
    maxDecimalPlaces: 4,
  })
  @Min(0.0001)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPriceCents!: number;
}

export class UpdateEstimateDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  jobId?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountCents?: number;

  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 4,
  })
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => UpdateEstimateLineItemDto)
  lineItems?: UpdateEstimateLineItemDto[];
}
