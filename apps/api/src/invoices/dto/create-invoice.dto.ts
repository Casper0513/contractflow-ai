import { Type } from 'class-transformer';
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

export class CreateInvoiceLineItemDto {
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

export class CreateInvoiceDto {
  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  sourceEstimateId?: string;

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
  issueDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  discountCents?: number;

  /**
   * Decimal multiplier.
   *
   * Examples:
   * 0.05 = 5%
   * 0.13 = 13%
   */
  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 4,
  })
  @Min(0)
  taxRate?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];
}
