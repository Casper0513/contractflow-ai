import { CustomerInternalNoteKind } from '@contractflow/db';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCustomerInternalNoteDto {
  @IsOptional()
  @IsEnum(CustomerInternalNoteKind)
  kind?: CustomerInternalNoteKind;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @IsOptional()
  @IsString()
  assignedToUserId?: string | null;

  @IsOptional()
  @IsISO8601()
  dueAt?: string | null;
}
